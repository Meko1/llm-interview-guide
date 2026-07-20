# 实时语音 Agent 生产化：低延迟、可打断与可审计会话

实时语音 Agent 不是把 ASR、LLM、TTS 三个 API 串起来。用户会抢话、停顿、改口；网络会抖动；电话通道有回声和丢包；语音里还可能出现身份信息、支付指令和情绪风险。要做到“像自然对话一样”，系统必须同时管理音频流、轮次状态、模型流、合成播放和业务动作。

语音模型原理见 [语音大模型](/multimodal/speech)，流式连接与恢复见 [LLM 流式应用生产化](/engineering/llm-streaming-production)。本页专注级联式或实时语音 API 的应用工程：如何把端到端时延、barge-in、工具调用、安全合规和观测做成可运行的生产系统。

## 一、先选择产品形态：级联、端到端还是混合

```text
级联：audio -> VAD/ASR -> text LLM/RAG/tools -> text -> TTS -> audio
端到端：audio tokens -> realtime multimodal model -> audio tokens
混合：audio -> streaming ASR + text reasoning/tooling -> streaming TTS
```

| 方案 | 适合 | 主要优势 | 主要代价 |
| --- | --- | --- | --- |
| 级联 | 客服、质检、强审计业务 | 文本可检索、可审核、可替换组件 | 串行延迟、丢失部分语气信息 |
| 端到端 | 陪伴、实时助手、自然对话 | 低延迟、保留情绪/语调、自然打断 | 观测和精细控制较难 |
| 混合 | 多数企业语音 Agent | 保留文本推理与工具能力，又能流式回应 | 状态同步和接口更复杂 |

不要把端到端说成永远更先进。对金融客服、呼叫中心等场景，文本中间态、证据引用、内容审核和工具权限往往比少几百毫秒更重要。

## 二、端到端时延预算：先看首句，不只看总时长

语音体验可拆为：

```text
end-of-user-turn
  -> VAD/endpointing
  -> ASR final or partial stabilization
  -> retrieval/tool prework
  -> LLM TTFT
  -> TTS first audio chunk
  -> network jitter buffer / playback
```

可用总预算近似表示为：

$$T_{first\_audio}=T_{endpoint}+T_{asr}+T_{orchestration}+T_{llm\_ttft}+T_{tts\_first}+T_{network}$$

各段都可能是瓶颈。盲目切更快的模型未必改善体验：若 endpointing 一直等待用户静音 1 秒，或 TTS 只等全文才开始合成，模型再快也不会显得自然。应分别观测“用户停顿到系统开始说话”“LLM 首 token”“TTS 首音频帧”和“实际播放”四个时间点。

## 三、音频入口：VAD、端点检测与会话轮次

客户端通常将 10 到 40ms 音频帧经 WebRTC、WebSocket 或电话媒体网关发送。服务端做采样率/编码统一、抖动缓冲、VAD（语音活动检测）和 endpointing。

- **VAD** 判断当前帧有没有人声，帮助节省 ASR 与带宽。
- **endpointing** 判断一句话何时结束。阈值太短会把正常停顿误判为结束，太长又拖慢首句响应。
- **partial transcript** 在用户还说话时不断更新；**final transcript** 作为本轮稳定输入进入工具和业务动作。

端点策略应允许按场景配置：电话客服可接受稍长静音以降低误切，语音搜索追求更快结束，儿童/方言/嘈杂环境可能需要更保守的 VAD。不要把 ASR partial 当作永久事实；下游若已开始检索或生成，应能在 final 修订后取消或重规划。

## 四、Barge-in：用户打断时系统如何真正停下来

用户开口通常意味着“停止播报，回到倾听”。正确的 barge-in 是一条取消链，而不是前端静音：

```text
new speech detected
  -> stop local audio playback
  -> cancel TTS synthesis stream
  -> cancel/mark stale LLM generation
  -> cancel unused tool work when safe
  -> increment turn_epoch and start listening
```

`turn_epoch` 或 fence token 很关键。所有 ASR、LLM、TTS、工具事件都携带当前 epoch；旧轮次在网络延迟后才到达的音频和文本必须被丢弃，不能在用户新问题上继续播放“上一轮的答案”。

取消还要区分读操作和写操作：检索、TTS、模型生成可以尽快 abort；已提交的支付、工单修改等写操作不能简单终止，必须走 [人工审批与异常接管](/interview/llm-human-approval-exception-handoff-playbook) 和幂等/对账流程。

## 五、流式 ASR、LLM 与 TTS 的拼接策略

低延迟不是对每个字符都调用 TTS。常见策略是让 LLM delta 进入一个**语义分段器**：遇到句号、逗号、稳定短语或最大等待窗口时，提交 TTS 合成；TTS 返回音频 chunk 后立即播放。

```text
ASR partial -> final transcript -> LLM deltas
                                   -> phrase buffer -> TTS stream -> client playback
```

分段过短会使语调断裂、TTS 请求多、成本高；分段过长又增加首音频延迟。可用标点、语言规则、token 时间窗和 TTS 模型的最小稳定长度共同控制。对于数字、金额、日期和专名，最好在语音化前用结构化渲染规则处理，避免模型把“2026-07-20”读得含糊或把金额读错。

## 六、回声、双工与说话人问题

电话和扬声器场景中，麦克风会收进系统自己播放的 TTS，VAD 可能把它当成用户插话。需要客户端/媒体层的回声消除（AEC）、噪声抑制和回声参考信号；不要完全依赖 LLM 从文本中“判断是不是自己说的话”。

多人会议还需要 diarization（说话人分离）和 speaker attribution。业务动作必须绑定经过身份验证的说话人，而不是只因音频里出现“请给我转账”就执行。声纹可以作为辅助信号，但不应是高风险操作的唯一身份因子。

## 七、工具调用、确认与语音 UX

语音比文字更容易被误听。涉及金额、地址、身份或不可逆操作时，推荐“复述确认”模式：

1. 模型先生成结构化 action preview，不执行。
2. TTS 用清晰、可核验的格式读出关键参数。
3. 用户用明确确认语句或屏幕二次确认授权。
4. 策略层、权限层和执行器完成最终校验后执行。

不能把“好的”“嗯”一律解析为批准。确认状态必须与 `action_id`、当前会话 epoch、有效期和用户身份绑定；超时、插话或参数改动都应使确认失效。

## 八、隐私、录音和声纹治理

语音天然包含身份、情绪、环境和生物特征信息。系统需明确：是否录音、保留多久、谁可回放、转写文本与原音频是否同等敏感、模型供应商是否可使用数据训练。

推荐最小化原则：默认只保留完成服务所需的数据；以加密对象存储保存录音，访问使用短期授权和审计；日志以 `call_id`、版本、时长、脱敏转写和策略事件为主。对于声纹克隆、实时变声或身份验证，必须增加显式授权、用途限制、水印/检测和高风险人工复核。

## 九、可靠性：重连、降级与通话结束

语音会话同时有媒体连接和业务会话。媒体重连不应自动创建第二个业务轮次：客户端携带 `call_id`、`turn_epoch` 和最后确认的事件序号，服务端恢复可恢复状态；超过窗口则安全结束并提示重新开始。

降级阶梯可包括：实时模型不可用 -> 级联 ASR+文本 LLM+TTS -> 仅文本聊天/人工坐席；TTS 失败 -> 展示文本并保持会话；ASR 置信度过低 -> 请用户重复或转人工。必须明确每个降级是否仍满足合规和工具能力要求。

## 十、观测与评测：语音质量不是一个数字

| 指标 | 关注问题 |
| --- | --- |
| endpoint-to-first-audio P50/P95 | 用户停下后多久听到系统回应 |
| ASR WER/CER 与 final-revision rate | 转写是否正确、partial 是否频繁推翻 |
| barge-in success / stale-audio rate | 打断是否及时，旧轮次是否漏播 |
| turn completion / handoff rate | 用户是否完成任务、何时需要人工 |
| TTS first-frame / playback underrun | 合成与网络是否造成卡顿 |
| action confirmation mismatch | 用户确认与执行参数是否一致 |
| privacy-policy hit / recording access | 数据治理是否有效 |

语音评测需按噪声、口音、语言、设备、网络、说话速度和业务意图切片。仅在安静普通话样本上 WER 很低，不代表电话、方言或嘈杂车载场景可用。人类主观 MOS（自然度）也应和任务成功率、误操作率一起看。

## 十一、系统设计答题框架

题目：“设计一个支持打断、查订单和转人工的电话语音客服。”

1. 澄清通话量、目标延迟、语言/口音、录音合规、可执行动作和人工 SLA。
2. 媒体层用 WebRTC/电话网关接收帧，做 AEC、VAD、endpointing 与流式 ASR。
3. 会话编排器维护 `call_id`、`turn_epoch`、partial/final transcript、模型流和工具状态。
4. LLM 输出经语义分段器进入流式 TTS；用户发声时以 epoch 取消旧 TTS/生成并回到倾听。
5. 工具调用走 schema、权限与审批；高风险参数做复述和显式确认。
6. 失败时降级到文本或人工，媒体重连使用事件序号恢复，不重复执行动作。
7. 观测首音频、ASR 修订、打断成功、任务完成、转人工和隐私审计。

## 十二、面试高频问答

### Q1：为什么只优化模型 TTFT 不足以改善语音体验？

用户感知的是从停止说话到听到第一段音频的全链路，endpointing、ASR final、编排、TTS 首帧和网络都可能主导。必须分段追踪并按瓶颈优化。

### Q2：Barge-in 如何避免旧回答在新问题后继续播放？

每一轮使用递增的 epoch/fence token；检测到新语音后取消播放和可取消任务。所有异步事件到达时校验 epoch，不匹配就丢弃，避免延迟消息污染新轮次。

### Q3：ASR partial 能否直接触发工具调用？

不应直接执行写操作。partial 会被修订，最多用于预取低风险检索或界面反馈；工具执行以 final transcript、用户确认和权限策略为准。

### Q4：语音确认“好的”为什么不够？

它缺少动作和参数绑定，可能对应多个未完成计划，也可能是随口回应。高风险确认要绑定 `action_id`、关键参数、有效期和身份，必要时辅以屏幕或二次认证。

### Q5：语音 Agent 遇到上游实时模型故障如何降级？

根据能力契约切换到级联管线或文本/人工：确保新路径仍能满足数据驻留、审核和工具权限要求；会话状态要明确迁移，不能无提示地重置或重复执行。

### Q6：如何衡量一个语音 Agent 的成功？

同时看端到端首音频、ASR/理解质量、TTS 自然度、打断成功、任务完成、误操作、转人工率和隐私事件。低延迟但频繁误办业务不是成功。

## 十三、60 秒收束回答

> 我会把实时语音 Agent 当成一个带轮次 fence 的流式状态机，而不是 ASR-LLM-TTS 的串联。音频入口先做 AEC、VAD、endpointing 和流式 ASR；final transcript 才驱动业务规划，LLM delta 经语义分段后流式 TTS。用户插话时递增 turn epoch，取消旧播放和可取消的生成/检索，迟到事件按 epoch 丢弃。高风险工具动作使用结构化预览、复述确认、权限和审批，不把模糊语气词当授权。最后按首音频、ASR 修订、打断成功、任务完成和录音访问审计做运营闭环，并准备降级到级联、文本或人工坐席。
