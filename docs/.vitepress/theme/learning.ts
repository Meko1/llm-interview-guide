export const levels = [
  { id: 'L0', name: '入门', goal: '建立图景，讲清概念', link: '/beginner/getting-started' },
  { id: 'L1', name: '应用', goal: '搭建应用，选型排障', link: '/paths/application' },
  { id: 'L2', name: '工程', goal: '权衡质量、成本与稳定性', link: '/paths/backend' },
  { id: 'L3', name: '研究', goal: '理解推导，设计实验', link: '/paths/research' },
  { id: 'L4', name: '前沿', goal: '辨别贡献与开放问题', link: '/paths/frontier' }
]

export const paths = [
  { id: 'student', title: '在校生 / 初次入门', role: '在校生', level: 'L0 → L1', description: '从模型直觉与 Python 实践出发，形成能讲清楚的小项目。', output: '交付：最小 RAG 与原理复述', link: '/paths/student' },
  { id: 'backend', title: '后端工程师转型', role: '后端转型', level: 'L1 → L2', description: '复用服务工程经验，补齐检索、工具调用、评测与生产边界。', output: '交付：有质量门禁的 AI 服务', link: '/paths/backend' },
  { id: 'application', title: 'AI 应用开发', role: '应用开发', level: 'L1 → L2', description: '沿 RAG 与 Agent 主线，把一个能演示的应用做成可解释的系统。', output: '交付：失败分析与选型记录', link: '/paths/application' },
  { id: 'research', title: '算法与研究', role: '算法研究', level: 'L1 → L3', description: '从张量、目标函数和推导进入论文，把结论变成可复现的实验。', output: '交付：基线、消融与复现报告', link: '/paths/research' }
]

export const featured = [
  { url: '/basics/transformer', question: '一个 token 如何穿过 Transformer？', note: '从数据流理解组件，再估算参数与计算。' },
  { url: '/basics/attention', question: 'Attention 的瓶颈究竟在哪里？', note: '形状、掩码、复杂度与数值稳定性。' },
  { url: '/inference/kv-cache', question: '长上下文的显存账，怎么算？', note: '用可复算公式区分架构、缓存与调度。' },
  { url: '/rag/rag-basics', question: '检索到了，为什么还是答错？', note: '定位召回、上下文与生成的分段失败。' },
  { url: '/agent/agent-basics', question: 'Agent 怎么从演示走向可靠执行？', note: '控制循环、权限边界与重复副作用。' }
]
