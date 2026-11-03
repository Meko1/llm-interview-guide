<script setup lang="ts">
import { withBase } from 'vitepress'
import records from '../../../_data/pages.json'
import { featured, levels, paths } from '../learning'
import PathFinder from './PathFinder.vue'

const articles = records.filter(page => page.article)
const sections = [...new Map(articles.map(page => [page.folder, { name: page.section, folder: page.folder }])).values()]
const picks = featured.map(item => ({ ...item, page: articles.find(page => page.url === item.url) }))
const sectionLink = (folder: string) => articles.find(page => page.folder === folder)?.url || '/catalog'
</script>

<template>
  <main id="guide-home" class="guide-home">
    <section class="guide-hero" aria-labelledby="home-title">
      <div class="hero-copy">
        <h1 id="home-title">把大模型知识，<br />变成你的<span>判断力。</span></h1>
        <p>以面试为入口，以真正理解为目标。<br />从模型原理到生产落地，建立能解释、能实现、能做取舍的知识体系。</p>
        <div class="hero-actions"><a class="guide-button" :href="withBase('/paths/')">找到我的学习路径 →</a><a class="guide-text-link" :href="withBase('/catalog')">探索知识地图 ↗</a></div>
        <p class="hero-index">{{ articles.length }} 篇知识文章 · {{ sections.length }} 个板块 · L0–L4 分层入口<a :href="withBase('/reading-guide')">统计与分级口径</a></p>
      </div>
      <aside class="hero-reading" aria-label="学习与面试能力框架">
        <h2>不是背出答案。<br />是说清为什么。</h2>
        <dl>
          <div><dt>理解机制</dt><dd>从数据流、公式与假设出发</dd></div>
          <div><dt>构建系统</dt><dd>用实现、评测与失败验证理解</dd></div>
          <div><dt>做出判断</dt><dd>在质量、成本与边界之间取舍</dd></div>
        </dl>
        <a :href="withBase('/interview/high-frequency')">带着追问阅读 →</a>
      </aside>
    </section>

    <section class="home-section" aria-labelledby="paths-title">
      <div class="section-heading"><div><h2 id="paths-title">从你的起点出发</h2><p>不同岗位，不同深度。先选主线，再按问题深入。</p></div><a :href="withBase('/paths/infra')">推理与 Infra 专线 ↗</a></div>
      <div class="path-grid">
        <a v-for="path in paths" :key="path.id" class="path-entry" :href="withBase(path.link)">
          <div class="path-entry-title"><h3>{{ path.title }}</h3><span aria-hidden="true">↗</span></div>
          <p>{{ path.description }}</p><div class="path-entry-footer"><span>{{ path.level }}</span><span>{{ path.output }}</span></div>
        </a>
      </div>
    </section>

    <section class="home-section featured-section" aria-labelledby="featured-title">
      <div class="featured-intro"><h2 id="featured-title">五个问题，<br />一条能力主线。</h2><p>不只知道名词。沿着原理、资源、检索与执行，练习回答下一层追问。</p><a :href="withBase('/reading-guide')">怎样验证自己真的理解了 →</a></div>
      <ol class="featured-list">
        <li v-for="item in picks" :key="item.url"><a :href="withBase(item.url)"><div><h3>{{ item.question }}</h3><p>{{ item.note }}</p></div><span class="featured-meta">{{ item.page?.level }}<br />约 {{ item.page?.readingMinutes }} 分钟</span></a></li>
      </ol>
    </section>

    <section class="home-section" aria-labelledby="levels-title">
      <div class="section-heading"><div><h2 id="levels-title">同一张地图，五种阅读深度</h2><p>级别描述阅读起点，不限定你的成长上限。</p></div><a :href="withBase('/reading-guide')">查看分级说明 ↗</a></div>
      <div class="level-track"><a v-for="item in levels" :key="item.id" :href="withBase(item.link)"><span class="level-id">{{ item.id }}</span><h3>{{ item.name }}</h3><p>{{ item.goal }}</p></a></div>
    </section>

    <section class="home-section" aria-labelledby="map-title">
      <div class="section-heading"><div><h2 id="map-title">知识索引</h2><p>按主题深入，也可以在完整目录中组合筛选。</p></div><a :href="withBase('/catalog')">全部文章与筛选 →</a></div>
      <div class="topic-index"><a v-for="section in sections" :key="section.folder" :href="withBase(sectionLink(section.folder))"><span>{{ section.name }}</span><span>{{ articles.filter(page => page.folder === section.folder).length }} 篇 ↗</span></a></div>
    </section>

    <section class="home-section finder-section" aria-labelledby="finder-title"><h2 id="finder-title">还不知道从哪里开始？</h2><p>告诉我们目标、基础与时间。推荐仅在本地计算，不收集个人信息。</p><PathFinder /></section>
    <footer class="home-editorial-note"><p>持续整理，分批审校。内容数量不等于质量认证；初次分级与技术审校状态明确区分。</p><a :href="withBase('/reading-guide')">了解编辑原则与阅读口径 →</a></footer>
  </main>
</template>
