<script setup lang="ts">
import { withBase } from 'vitepress'
import records from '../../../_data/pages.json'
import { levels, paths, featured } from '../learning'
import PathFinder from './PathFinder.vue'
import CapabilityMap from './CapabilityMap.vue'
import AtlasIcon from './AtlasIcon.vue'
const articles = records.filter(page => page.article)
const sections = [...new Map(articles.map(page => [page.folder, { name: page.section, folder: page.folder }])).values()]
const picks = featured.map(item => ({ ...item, page: articles.find(page => page.url === item.url) }))
const sectionLink = (folder: string) => articles.find(page => page.folder === folder)?.url || '/catalog'
</script>

<template>
  <main id="guide-home" class="atlas-home">
    <section class="atlas-hero" aria-labelledby="home-title">
      <div class="hero-inner">
        <div class="hero-heading"><h1 id="home-title">看见原理。<br />建立你的<span>能力坐标。</span></h1><p>从理解一个 token，到构建一个可靠系统。<br />在大模型能力地图中，找到下一步。</p><div class="hero-actions"><a class="atlas-primary" :href="withBase('/paths/')">找到我的学习路径<AtlasIcon /></a><a class="atlas-secondary" :href="withBase('/catalog')">探索全部知识<AtlasIcon name="expand" /></a></div><div class="hero-context"><span>{{ articles.length }} 篇知识文章</span><span>{{ sections.length }} 个知识板块</span><a :href="withBase('/reading-guide')">L0–L4 分层阅读<AtlasIcon name="expand" :size="14" /></a></div></div>
        <CapabilityMap />
      </div>
      <div class="hero-bottom"><span>不止于答案，更在于为什么。</span><span>选择地图节点，沿着问题深入。</span></div>
    </section>

    <section class="atlas-section home-paths" aria-labelledby="paths-title">
      <div class="atlas-section-heading"><div><h2 id="paths-title">你的起点，<br />决定下一段旅程。</h2><p>不用从第一页读起。选择一条主线，留下可验证的实践产出。</p></div><a class="atlas-inline" :href="withBase('/paths/')">查看全部学习路线<AtlasIcon /></a></div>
      <div class="atlas-paths"><a v-for="(path, index) in paths" :key="path.id" :href="withBase(path.link)" class="atlas-path"><div class="path-visual" :class="'path-visual-' + index" aria-hidden="true"><svg viewBox="0 0 240 110"><path :d="index % 2 === 0 ? 'M15 85H60L100 35H155L195 65H225' : 'M15 75H50L85 40H130L170 20H225'" /><circle cx="15" :cy="index % 2 === 0 ? 85 : 75" r="5" /><circle cx="225" :cy="index % 2 === 0 ? 65 : 20" r="6" /><circle cx="100" cy="35" r="3" /></svg><span>{{ path.level }}</span></div><h3>{{ path.title }}<AtlasIcon name="expand" /></h3><p>{{ path.description }}</p><span class="path-deliverable">{{ path.output }}</span></a></div><div class="path-extra"><span>更深入的方向</span><a :href="withBase('/paths/infra')">推理与 Infra<AtlasIcon name="expand" :size="16" /></a><a :href="withBase('/paths/frontier')">前沿贡献判断<AtlasIcon name="expand" :size="16" /></a></div>
    </section>

    <section class="atlas-featured" aria-labelledby="featured-title"><div class="atlas-section featured-inner"><div class="featured-intro"><h2 id="featured-title">{{ picks.length }} 个问题。<br />从原理到行动。</h2><p>不是收集更多名词，而是把知识连成可以解释、实现和取舍的系统。</p><a :href="withBase('/basics/transformer')" class="atlas-secondary">进入交互图解<AtlasIcon /></a><div class="feature-signal" aria-hidden="true"><svg viewBox="0 0 220 100"><path d="M0 70H35L55 25H95L115 70H155L175 35H220"/><circle cx="55" cy="25" r="5"/><circle cx="175" cy="35" r="5"/></svg></div></div><ol class="atlas-reading-list"><li v-for="(item, index) in picks" :key="item.url"><a :href="withBase(item.url)"><span class="reading-sequence">{{ index + 1 }}</span><div><h3>{{ item.question }}</h3><p>{{ item.note }}</p></div><span class="reading-meta">{{ item.page?.level }}<br />{{ item.page?.readingMinutes }} 分钟</span><AtlasIcon /></a></li></ol></div></section>

    <section class="atlas-section home-levels" aria-labelledby="levels-title"><div class="atlas-section-heading"><div><h2 id="levels-title">同一张地图，<br />不同的探索深度。</h2><p>级别描述阅读门槛，不限定你的成长上限。</p></div><a class="atlas-inline" :href="withBase('/reading-guide')">理解分级<AtlasIcon /></a></div><div class="atlas-levels"><a v-for="item in levels" :key="item.id" :href="withBase(item.link)"><span class="atlas-level-id">{{ item.id }}</span><h3>{{ item.name }}</h3><p>{{ item.goal }}</p><AtlasIcon name="arrow" :size="18" /></a></div></section>

    <section class="atlas-section home-topics" aria-labelledby="map-title"><div class="atlas-section-heading"><div><h2 id="map-title">一张不断延伸的知识地图。</h2><p>沿主题建立全景，带着具体问题回到细节。</p></div><a class="atlas-inline" :href="withBase('/catalog')">打开完整目录<AtlasIcon /></a></div><div class="atlas-topics"><a v-for="section in sections" :key="section.folder" :href="withBase(sectionLink(section.folder))"><span>{{ section.name }}</span><span>{{ articles.filter(page => page.folder === section.folder).length }} 篇<AtlasIcon name="expand" :size="16" /></span></a></div></section>

    <section class="atlas-section atlas-finder" aria-labelledby="finder-title"><div><h2 id="finder-title">下一步，从这里开始。</h2><p>选择你的目标、基础与时间。所有推荐在本地完成。</p></div><PathFinder /></section>
    <footer class="atlas-home-footer"><div><img :src="withBase('/atlas-mark.svg')" width="28" height="28" alt="" /><strong>Atlas</strong><span>大模型能力地图</span></div><p>持续整理，分批审校。内容数量不代表质量认证。</p><a :href="withBase('/reading-guide')">阅读与编辑原则<AtlasIcon name="expand" :size="16" /></a></footer>
  </main>
</template>
