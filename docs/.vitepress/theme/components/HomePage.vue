<script setup lang="ts">
import { withBase } from 'vitepress'
import records from '../../../_data/pages.json'
import { levels, paths, featured } from '../learning'
import PathFinder from './PathFinder.vue'
import AtlasIcon from './AtlasIcon.vue'
import AttentionPreview from './AttentionPreview.vue'
const articles = records.filter(page => page.article)
const sections = [...new Map(articles.map(page => [page.folder, { name: page.section, folder: page.folder }])).values()]
const picks = featured.filter(item => item.url !== '/basics/transformer').map(item => ({ ...item, page: articles.find(page => page.url === item.url) }))
const primaryPaths = paths.filter(path => ['application', 'research'].includes(path.id))
const secondaryPaths = paths.filter(path => !['application', 'research'].includes(path.id))
const sectionLink = (folder: string) => '/catalog?section=' + encodeURIComponent(articles.find(page => page.folder === folder)?.section || '')
</script>

<template>
  <main id="guide-home" class="atlas-home zhixu-editorial">
    <section class="issue-cover" aria-labelledby="home-title">
      <div class="issue-layout">
        <div class="issue-story">
          <p class="issue-topic">模型原理专题</p>
          <h1 id="home-title">一个 token 如何<br />穿过 <span lang="en">Transformer</span>？</h1>
          <p class="issue-deck">跟踪一个词元经过嵌入、注意力和前馈网络时的变化，用一张数据流图讲清模型如何生成下一个词元。</p>
          <a class="issue-read" :href="withBase('/basics/transformer')">阅读交互图解<AtlasIcon :size="18" /></a>
        </div>
        <nav id="paths-title" class="issue-routes" aria-label="两条主要学习路线">
          <a v-for="path in primaryPaths" :key="path.id" :href="withBase(path.link)">
            <div><strong>{{ path.id === 'application' ? '应用开发与面试' : '算法与训练研究' }}</strong>
              <small>{{ path.id === 'application' ? 'RAG、Agent 与系统设计' : '模型推导、训练与复现实验' }}</small>
            </div>
            <AtlasIcon name="expand" :size="20" />
          </a>
        </nav>
        <AttentionPreview />
      </div>
      <details class="issue-other">
        <summary>其他学习入口</summary>
        <nav aria-label="更多学习路线">
          <a v-for="path in secondaryPaths" :key="path.id" :href="withBase(path.link)">{{ path.title }}</a>
          <a :href="withBase('/paths/infra')">推理与 Infra</a>
          <a :href="withBase('/paths/frontier')">前沿贡献判断</a>
          <a :href="withBase('/capability-map')">能力定位</a>
          <a :href="withBase('/paths/')">全部路线</a>
        </nav>
      </details>
    </section>

    <section class="atlas-featured" aria-labelledby="featured-title"><div class="atlas-section featured-inner"><div class="featured-intro"><h2 id="featured-title">问题选读</h2><p>选一道题，先写下自己的判断。读完机制，再用文末练习检查你的推导或方案。</p><a :href="withBase('/catalog')" class="atlas-secondary">浏览知识目录<AtlasIcon /></a></div><ol class="atlas-reading-list"><li v-for="(item, index) in picks" :key="item.url"><a :href="withBase(item.url + (item.anchor || ''))"><span class="reading-sequence">{{ String(index + 1).padStart(2, '0') }}</span><div><h3>{{ item.question }}</h3><p>{{ item.note }}</p></div><span class="reading-meta">{{ item.page?.level }}<br />{{ item.page?.readingMinutes }} 分钟</span><AtlasIcon /></a></li></ol></div></section>

    <section class="atlas-section home-levels" aria-labelledby="levels-title"><div class="atlas-section-heading"><div><h2 id="levels-title">阅读分级</h2><p>级别描述阅读门槛，不限定你的成长上限。</p></div><a class="atlas-inline" :href="withBase('/reading-guide')">理解分级<AtlasIcon /></a></div><div class="atlas-levels"><a v-for="item in levels" :key="item.id" :href="withBase(item.link)"><span class="atlas-level-id">{{ item.id }}</span><h3>{{ item.name }}</h3><p>{{ item.goal }}</p><AtlasIcon name="arrow" :size="18" /></a></div></section>

    <section class="atlas-section home-topics" aria-labelledby="map-title"><div class="atlas-section-heading"><div><h2 id="map-title">学科目录</h2><p>沿主题建立全景，带着具体问题回到细节。</p></div><a class="atlas-inline" :href="withBase('/catalog')">打开完整目录<AtlasIcon /></a></div><div class="atlas-topics"><a v-for="section in sections" :key="section.folder" :href="withBase(sectionLink(section.folder))"><span>{{ section.name }}</span><span>{{ articles.filter(page => page.folder === section.folder).length }} 篇<AtlasIcon name="expand" :size="16" /></span></a></div></section>

    <section class="atlas-section atlas-finder" aria-labelledby="finder-title"><div><h2 id="finder-title">规划学习路线</h2><p>选择你的目标、基础与时间。所有推荐在本地完成。</p></div><PathFinder /></section>
    <footer class="atlas-home-footer"><div><img :src="withBase('/zhixu-mark.svg')" width="28" height="28" alt="" /><strong>知序</strong><span>LLM 学习手册</span></div><p>持续整理，分批审校。内容数量不代表质量认证。</p><a :href="withBase('/reading-guide')">阅读与编辑原则<AtlasIcon name="expand" :size="16" /></a></footer>
  </main>
</template>
