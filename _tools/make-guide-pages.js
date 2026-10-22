/*
 * make-guide-pages.js — 영어·일본어·중국어 안내 페이지를 만든다.
 *
 *   node _tools/make-guide-pages.js
 *
 * 글은 모두 아래 표(LANGS)에 모여 있습니다. 문구를 고칠 일이 생기면
 * 이 표만 고치고 다시 돌리면 세 페이지가 같은 모양으로 다시 만들어집니다.
 * 주소(/en/ /ja/ /zh/)는 바뀌지 않으므로 이미 인쇄한 QR 은 그대로 쓰면 됩니다.
 *
 * 펼침 목록 안쪽 그림: assets/guide/<언어>/mo|pc/1~9.png
 *   mo = 좁은 화면(휴대폰), pc = 넓은 화면. 화면 너비에 따라 저절로 바뀝니다.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

/* 세 언어가 공통으로 쓰는 차례 */
const ORDER = [1, 2, 3, 4, 5, 6, 7, 8, 9];

const LANGS = [
  {
    dir: 'en',
    code: 'ENG',
    htmlLang: 'en',
    fonts: 'family=Noto+Sans:wght@400;700&family=Noto+Sans+Mono:wght@400;700&family=Noto+Serif:wght@400;700',
    serif: "'Noto Serif', Georgia, 'Times New Roman', serif",
    sans: "'Noto Sans', system-ui, -apple-system, 'Segoe UI', sans-serif",
    mono: "'Noto Sans Mono', ui-monospace, 'SFMono-Regular', Consolas, monospace",

    brand: 'Testimony : The Next Page',
    docTitle: 'Testimony : The Next Page — Exhibition Guide',
    docDesc: 'Visitor guide to “Testimony — The Next Page”, a special exhibition hosted by the Research Institute on Japanese Military Sexual Slavery (RIMSS), Women’s Human Rights Institute of Korea.',
    tabGuide: 'Exhibition Guide',
    tabHall: 'Online Exhibition 3D',

    host: 'Special exhibition hosted by the Research Institute on Japanese Military Sexual Slavery (RIMSS), Women’s Human Rights Institute of Korea',
    title1: 'Testimony',
    title2: '— The Next Page',
    rec: 'The 2,745th Record',
    lead: 'How should we respond to the words entrusted to us? The journey begins to write the 2,745th record — the next page to the 2,744 records that came before.',
    venues: [
      { name: 'Ara Art Center, Seoul', when: 'Oct 23 (Fri) – Nov 11 (Wed)<br>2026' },
      { name: 'Art Space Lumos, Daegu', when: 'Nov 15 (Sun) – Dec 4 (Fri)<br>2026' },
    ],

    noticeTitle: 'Before You Visit',
    noticeBody: 'This exhibition includes testimonies from victims of war crimes. Pregnant visitors, older adults, those in poor health, and visitors who may find these accounts distressing are advised to exercise caution.',

    quote: '“My Heart Is Not Broken Yet”',
    quoteBy: '— Song Shin-do (1922–2017)',
    quoteBody: 'This exhibition revisits the Japanese military “comfort women” issue through testimony, approaching this unresolved issue as a book. Yet, this book remains unfinished. And an unfinished story needs a next page. It is up to us to fill the blank space on that next page.',

    sectionsTitle: 'Exhibition Sections',
    expand: 'Expand all',
    collapse: 'Collapse all',

    items: [
      { t: 'Information Desk', d: 'Entrance texts: preface, credits and visitor notices.' },
      { t: 'Preface: A Timeline of the Movement', d: 'From 1975 to 2026: the history of the movement led by witnesses and researchers.' },
      { t: 'Part 1. Contemporary History: 2,744 Records', d: 'The 2,744 records nominated for UNESCO’s Memory of the World Register.' },
      { t: 'Part 2. Voices of Testimony', d: 'Face five witnesses: Kim Bok-dong, Kang Il-chul, Lee Ok-sun, Song Shin-do and Gil Won-ok.' },
      { t: 'Paths of Memory', d: 'Follow the map of Asia to find where victims were taken, and the records left behind.' },
      { t: 'Testimonies Through Lives', d: 'Works and records left by witnesses and later-generation artists.' },
      { t: 'Transition Passage', d: 'A space where the voices of witnesses from around the world meet.' },
      { t: 'Part 3. The Messages Left by Numbers', d: 'History seen anew through numbers, and the records visitors leave.' },
      { t: 'The Forest of Archives', d: 'A space to freely browse related books and studies.' },
    ],

    surveyTitle: 'Take the visitor survey',
    surveySub: 'Gift vouchers awarded by prize draw',

    hallHost: 'Research Institute on Japanese Military Sexual Slavery (RIMSS), Women’s Human Rights Institute of Korea',
    hallTitle: 'The exhibition, rebuilt online',
    hallLead: 'A 3D virtual exhibition that lets you walk through all nine spaces in 360°. Choose a room below, or press Enter to follow the full visitor route.',
    enter: 'Enter the 3D exhibition',
    roomsTitle: 'Choose a room',
    rooms: [
      'Information Desk',
      'Preface · A Timeline of the Movement',
      'Part 1 · 2,744 Records',
      'Part 2 · Voices of Testimony',
      'Paths of Memory',
      'Testimonies Through Lives',
      'Transition Passage',
      'Part 3 · The Messages Left by Numbers',
      'The Forest of Archives',
    ],

    soonTitle: 'Opening Soon',
    soonBody: 'Scheduled to open on the 28th',
    soonOk: 'OK',
    close: 'Close',

    footOrg: 'Organized by Research Institute on Japanese Military Sexual Slavery (RIMSS), Women’s Human Rights Institute of Korea',
    footDesign: 'Exhibition design and installation · Diana Insight',
  },

  {
    dir: 'ja',
    code: 'JPN',
    htmlLang: 'ja',
    fonts: 'family=Noto+Sans+JP:wght@400;700&family=Noto+Sans+Mono:wght@400;700&family=Noto+Serif+JP:wght@400;700',
    serif: "'Noto Serif JP', 'Yu Mincho', 'Hiragino Mincho ProN', serif",
    sans: "'Noto Sans JP', 'Hiragino Sans', 'Yu Gothic', system-ui, sans-serif",
    mono: "'Noto Sans Mono', ui-monospace, Consolas, monospace",

    brand: '証言：次のページ',
    docTitle: '証言：次のページ — 展示案内',
    docDesc: '韓国女性人権振興院 日本軍「慰安婦」問題研究所 主催 特別展示「証言 — 次のページ」の観覧案内。',
    tabGuide: '展示案内',
    tabHall: 'オンライン展示館 3D',

    host: '韓国女性人権振興院　日本軍「慰安婦」問題研究所　主催　特別展示',
    title1: '証言',
    title2: '— 次のページ',
    rec: '2,745番目の記録',
    lead: '手渡された言葉に、私たちはどう向き合うべきか。2,744件の記録の次のページとなる、2,745番目の記録を書くための旅が始まる。',
    venues: [
      { name: 'ソウル アラアートセンター', when: '2026.10.23（金）～ 11.11（水）' },
      { name: '大邱 アートスペース ルモス', when: '2026.11.15（日）～ 12.04（金）' },
    ],

    noticeTitle: '観覧前のご案内',
    noticeBody: '本展示スペースには、戦争犯罪による被害者の発言が一部含まれております。妊娠中の方、ご高齢の方、心臓の弱い方や刺激に敏感な方は、観覧の際にご注意ください。',

    quote: '「私の心は負けていない」',
    quoteBy: '— ソン・シンド（1922〜2017）',
    quoteBody: '本展示では、日本軍「慰安婦」問題についての証言に集中的にスポットライトを当て、現在進行中の問題を一冊の「本」になぞらえている。それにもかかわらず、この本は完成できていない。そして足りない物語は次のページを求めている。その次のページの空白を埋めるのは、私たちの役目だ。',

    sectionsTitle: 'セクション別ご案内',
    expand: 'すべて開く',
    collapse: 'すべて閉じる',

    items: [
      { t: '総合案内', d: '入口の序文・クレジット・観覧上のご案内。' },
      { t: '序文：年表の道', d: '1975年から2026年まで、証言者と研究者たちが歩んだ運動史の流れ。' },
      { t: '第1部・現在史：2,744件の記録', d: 'ユネスコ世界記録遺産に共同登録を申請した記録2,744件。' },
      { t: '第2部：証言の声', d: 'キム・ボクドン、カン・イルチュル、イ・オクソン、ソン・シンド、キル・ウォンオク。5人の証言者と向き合う。' },
      { t: '記憶の経路', d: 'アジアの地図をたどり、被害者たちが移動させられた場所と記録を確認する。' },
      { t: '人生が示した証言', d: '被害者自身の作品と、記録、そして後世の作家たちの作品。' },
      { t: '転換通路', d: '白い布と壁に残された、23人の言葉。' },
      { t: '第3部：数字が残した言葉', d: '数字を手がかりに、日本軍「慰安婦」問題の歴史を見つめ直す。' },
      { t: '書庫の森', d: '関連する書籍や研究書を自由に閲覧できる場所。' },
    ],

    surveyTitle: '満足度アンケートに参加する',
    surveySub: '抽選でギフト券をプレゼント',

    hallHost: '韓国女性人権振興院　日本軍「慰安婦」問題研究所',
    hallTitle: '展示会場を、そのままオンラインに',
    hallLead: '9つの展示空間を360度で巡ることができる3D仮想展示館です。下の展示室を選ぶか、入場ボタンから全体の動線をたどってください。',
    enter: '3D展示館に入場する',
    roomsTitle: '展示室を選ぶ',
    rooms: [
      '総合案内',
      '序文・年表の道',
      '第1部・2,744件の記録',
      '第2部・証言の声',
      '記憶の経路',
      '人生が示した証言',
      '転換通路',
      '第3部・数字が残した言葉',
      '書庫の森',
    ],

    soonTitle: '公開準備中です',
    soonBody: '28日公開予定',
    soonOk: '確認',
    close: '閉じる',

    footOrg: '主催・韓国女性人権振興院 日本軍「慰安婦」問題研究所',
    footDesign: '演出・デザイン・(株)Dianainsight',
  },

  {
    dir: 'zh',
    code: 'CHN',
    htmlLang: 'zh-Hans',
    fonts: 'family=Noto+Sans+SC:wght@400;700&family=Noto+Sans+Mono:wght@400;700&family=Noto+Serif+SC:wght@400;700',
    serif: "'Noto Serif SC', 'Songti SC', 'SimSun', serif",
    sans: "'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', system-ui, sans-serif",
    mono: "'Noto Sans Mono', ui-monospace, Consolas, monospace",

    brand: '证言：下一页',
    docTitle: '证言：下一页 — 展览导览',
    docDesc: '韩国女性人权振兴院 日军“慰安妇”问题研究所主办特别展“证言 — 下一页”观展导览。',
    tabGuide: '展览导览',
    tabHall: '线上展馆 3D',

    host: '韩国女性人权振兴院　日军“慰安妇”问题研究所　主办　特别展',
    title1: '证言',
    title2: '— 下一页',
    rec: '第2,745份记录',
    lead: '对于传递到我们手中的话语，我们应当如何对待？接续2,744件档案的下一页——书写第2,745份记录的旅程就此开始。',
    venues: [
      { name: '首尔 ARA艺术中心', when: '2026.10.23（五）～ 11.11（三）' },
      { name: '大邱 Art Space LUMOS', when: '2026.11.15（日）～ 12.04（五）' },
    ],

    noticeTitle: '观展提示',
    noticeBody: '本展览空间包含部分战争罪行受害者的陈述。孕妇、老年人、体弱者及心理承受能力较弱者请谨慎观看。',

    quote: '“我的心没有输”',
    quoteBy: '— 宋神道（1922～2017）',
    quoteBody: '本展览以日军“慰安妇”问题的相关证言为中心重新审视这一问题，并将这一仍在进行中的问题比作一本“书”。然而，这本书至今尚未完结。而一个尚未完结的故事，需要有接续的下一页。填补下一页的空白，要由我们来完成。',

    sectionsTitle: '分区导览',
    expand: '全部展开',
    collapse: '全部收起',

    items: [
      { t: '服务台', d: '入口处的序文、展览团队信息与观展提示。' },
      { t: '序：年表之路', d: '1975—2026，围绕日军“慰安妇”问题的运动年表。' },
      { t: '第一部分现在史：2,744件记录', d: '共同申报联合国教科文组织世界记忆遗产的2,744件档案。' },
      { t: '第二部分：证言之声', d: '金福童、姜日出、李玉善、宋神道、吉元玉。与五位证言者相对。' },
      { t: '记忆的路径', d: '沿着亚洲地图，查看受害者们被迫辗转的地点与记录。' },
      { t: '生命呈现的证言', d: '受害者自己的作品、档案，以及后代艺术家的作品。' },
      { t: '转换通道', d: '留在白布和墙面上的二十三句话。' },
      { t: '第三部分：数字留下的讯息', d: '借助“数字”，以全新的视角审视日军“慰安妇”问题的历史。' },
      { t: '书库之林', d: '可以自由阅览相关图书与研究著作的空间。' },
    ],

    surveyTitle: '参与满意度调查',
    surveySub: '抽奖赠送礼品券',

    hallHost: '韩国女性人权振兴院　日军“慰安妇”问题研究所',
    hallTitle: '把展厅原样搬到线上',
    hallLead: '这是可以360度参观9个展览空间的3D虚拟展馆。请在下方选择展厅，或点击“入场”按钮，沿完整参观动线游览。',
    enter: '进入3D展馆',
    roomsTitle: '选择展厅',
    rooms: [
      '服务台',
      '序·年表之路',
      '第一部分·2,744件记录',
      '第二部分·证言之声',
      '记忆的路径',
      '生命呈现的证言',
      '转换通道',
      '第三部分·数字留下的讯息',
      '书库之林',
    ],

    soonTitle: '即将开放',
    soonBody: '预计28日开放',
    soonOk: '确认',
    close: '关闭',

    footOrg: '主办 · 韩国女性人权振兴院 日军“慰安妇”问题研究所',
    footDesign: '策展与设计 · DIANAINSIGHT 株式会社',
  },
];

/* 언어 고르는 단추는 두지 않습니다.
   언어마다 QR 이 따로 있어서, 찍으면 바로 그 언어 페이지로 들어옵니다. */

const COPYRIGHT = '© 2026 Diana Insight Inc.';

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function accordion(me) {
  return ORDER.map(function (n, i) {
    const it = me.items[i];
    const base = `../assets/guide/${me.dir}`;
    return `        <details class="item">
          <summary class="head">
            <span class="no">${String(n).padStart(2, '0')}</span>
            <span class="t"><b>${esc(it.t)}</b><em>${esc(it.d)}</em></span>
            <span class="chev" aria-hidden="true"></span>
          </summary>
          <div class="body">
            <picture>
              <source media="(min-width: 768px)" srcset="${base}/pc/${n}.png">
              <img src="${base}/mo/${n}.png" alt="${esc(it.t)}" loading="lazy" decoding="async">
            </picture>
          </div>
        </details>`;
  }).join('\n');
}

function rooms(me) {
  return ORDER.map(function (n, i) {
    return `          <button type="button" class="room" data-soon>
            <span class="no">${String(n).padStart(2, '0')}</span>
            <span class="rt">${esc(me.rooms[i])}</span>
            <span class="play" aria-hidden="true">▶</span>
          </button>`;
  }).join('\n');
}

function venues(me) {
  return me.venues.map(function (v) {
    return `          <div class="venue"><b>${esc(v.name)}</b><span>${v.when}</span></div>`;
  }).join('\n');
}

function page(me) {
  return `<!DOCTYPE html>
<html lang="${me.htmlLang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#1b1526">
<meta name="description" content="${esc(me.docDesc)}">
<title>${esc(me.docTitle)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?${me.fonts}&display=swap" rel="stylesheet">
<link rel="stylesheet" href="../assets/guide.css">
<style>
  :root {
    --serif: ${me.serif};
    --sans: ${me.sans};
    --mono: ${me.mono};
  }
</style>
</head>
<body data-lang="${me.dir}">

<header class="topbar">
  <div class="wrap">
    <a class="brand" href="./">
      <svg viewBox="0 0 24 24" fill="none" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 5h6a3 3 0 0 1 3 3v11a2.5 2.5 0 0 0-2.5-2.5H3z"/><path d="M21 5h-6a3 3 0 0 0-3 3v11a2.5 2.5 0 0 1 2.5-2.5H21z"/></svg>
      ${esc(me.brand)}
    </a>
  </div>
</header>

<div class="tabs">
  <div class="wrap">
    <div class="tabrow" role="tablist">
      <button type="button" class="tab" role="tab" data-view="guide" aria-selected="true">${esc(me.tabGuide)}</button>
      <button type="button" class="tab" role="tab" data-view="hall" aria-selected="false">${esc(me.tabHall)}</button>
    </div>
  </div>
</div>

<main>

  <!-- ───────── 전시 안내 ───────── -->
  <section id="view-guide">

    <div class="hero">
      <div class="wrap">
        <div class="hero-inner">
          <p class="host">${esc(me.host)}</p>
          <h1>${esc(me.title1)}<span class="l2">${esc(me.title2)}</span></h1>
          <p class="rec">${esc(me.rec)}</p>
          <p class="lead">${esc(me.lead)}</p>
        </div>
        <div class="venues">
${venues(me)}
        </div>
      </div>
    </div>

    <div class="notice">
      <div class="wrap">
        <span class="ico" aria-hidden="true">&#9888;</span>
        <div>
          <b>${esc(me.noticeTitle)}</b>
          <p>${esc(me.noticeBody)}</p>
        </div>
      </div>
    </div>

    <section class="quote">
      <div class="wrap">
        <div class="inner">
          <blockquote>${esc(me.quote)}</blockquote>
          <p class="by">${esc(me.quoteBy)}</p>
          <p class="qbody">${esc(me.quoteBody)}</p>
        </div>
      </div>
    </section>

    <section class="sections">
      <div class="wrap">
        <div class="sec-head">
          <h2>${esc(me.sectionsTitle)}</h2>
          <button type="button" class="expand" data-expand="${esc(me.expand)}" data-collapse="${esc(me.collapse)}">${esc(me.expand)}</button>
        </div>

${accordion(me)}

        <a class="survey" href="#" data-soon>
          <span>
            <b>${esc(me.surveyTitle)}</b>
            <span class="s">${esc(me.surveySub)}</span>
          </span>
          <span class="pen" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>
          </span>
        </a>
      </div>
    </section>

  </section>

  <!-- ───────── 온라인 전시관 ───────── -->
  <section id="view-hall" hidden>

    <div class="hero">
      <div class="wrap">
        <div class="hero-inner">
          <p class="host">${esc(me.hallHost)}</p>
          <h1>${esc(me.hallTitle)}</h1>
          <p class="rec">${esc(me.rec)}</p>
          <p class="lead">${esc(me.hallLead)}</p>
          <button type="button" class="enter" data-soon><span class="tri" aria-hidden="true">▶</span>${esc(me.enter)}</button>
        </div>
      </div>
    </div>

    <section class="rooms">
      <div class="wrap">
        <h2>${esc(me.roomsTitle)}</h2>
        <div class="grid">
${rooms(me)}
        </div>
      </div>
    </section>

  </section>

</main>

<footer>
  <div class="wrap">
    <p>${esc(me.footOrg)}<br>${esc(me.footDesign)}</p>
    <p class="copy">${COPYRIGHT}</p>
  </div>
</footer>

<div class="modal" id="soon" role="dialog" aria-modal="true" aria-labelledby="soon-t" hidden>
  <div class="box">
    <button type="button" class="x" aria-label="${esc(me.close)}">&times;</button>
    <h3 id="soon-t">${esc(me.soonTitle)}</h3>
    <p>${esc(me.soonBody)}</p>
    <button type="button" class="ok">${esc(me.soonOk)}</button>
  </div>
</div>

<script src="../assets/guide.js"></script>
</body>
</html>
`;
}

LANGS.forEach(function (me) {
  const dir = path.join(ROOT, me.dir);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), page(me), 'utf8');
  console.log('  /' + me.dir + '/  ' + me.docTitle);
});

console.log('\n✅ 안내 페이지 ' + LANGS.length + '개를 다시 만들었습니다.');
