/* 성수 스탬프투어 — 디자인·번역에서 뽑은 글귀를 설정에 넣습니다.
 *
 *   node _tools/seongsu-content.js            (무엇이 들어가는지만 보여 줍니다)
 *   node _tools/seongsu-content.js --쓰기
 *
 * 어디서 가져왔는지
 *   · 화면 그림      Downloads\2608-10_외주 (1)
 *   · 번역           카카오톡 폴더의 「한국체크인_성수 스탬프투어_영간번 번역 반영_v0.2.pptx」
 *                    (글귀 일부는 슬라이드 글상자에, 일부는 그림 안에 있습니다)
 *
 * **거점 이름은 세 언어 모두 영문**입니다 — 번역 PPT 에 「거점명은 고유명사라서 영어」.
 *
 * ⚠️ 주소는 1·2번만 디자인 화면에서 직접 확인했습니다.
 *    3~7번과 ★ 은 번역 PPT 의 목록 차례를 그대로 따른 것이라 한 번 봐 주셔야 합니다.
 *    영문 주소는 중문 주소를 도로명 표기 규칙대로 옮긴 것입니다 (디자인에 없었습니다).
 */

var fs = require('fs');
var path = require('path');

var FILE = path.join(__dirname, '..', 'config', 'seongsu.json');
var WRITE = process.argv.indexOf('--쓰기') >= 0 || process.argv.indexOf('--write') >= 0;

/* 거점 — 이름은 세 말 모두 같고, 주소만 말마다 다릅니다 */
var SPOTS = {
  ss1: {
    name: 'MUSINSA Megastore Seongsu',
    addr: {
      en: '62 Seongsui-ro, Seongdong-gu, Seoul',
      zhCN: '首尔城东区圣水二路62号',
      zhTW: '首爾城東區聖水二路62號'
    }
  },
  ss8: {
    name: 'MUSINSA STANDARD SEONGSU',
    addr: {
      en: '83 Yeonmujang-gil, Seongdong-gu, Seoul',
      zhCN: '首尔城东区演武场街83号',
      zhTW: '首爾城東區演武場街83號'
    }
  },
  ss2: {
    name: '29CM HOME SEONGSU',
    addr: {
      en: '57 Yeonmujang-gil, Seongdong-gu, Seoul',
      zhCN: '首尔城东区演武场街57号',
      zhTW: '首爾城東區演武場街57號'
    }
  },
  ss3: {
    name: 'MUSINSA KICKS SEONGSU',
    addr: {
      en: '96 Seongsui-ro, Seongdong-gu, Seoul B1–2F',
      zhCN: '首尔城东区圣水二路96号 B1~2F',
      zhTW: '首爾城東區聖水二路96號 B1~2F'
    }
  },
  ss4: {
    name: 'MUSINSA EMPTY SEONGSU',
    addr: {
      en: '97 Seongsui-ro, Seongdong-gu, Seoul',
      zhCN: '首尔城东区圣水二路97号',
      zhTW: '首爾城東區聖水二路97號'
    }
  },
  ss5: {
    name: 'RE EARTH VINTAGE',
    addr: {
      en: '38 Seongsui-ro 7-gil, Seongdong-gu, Seoul B1',
      zhCN: '首尔城东区圣水二路7街38号 B1',
      zhTW: '首爾城東區聖水二路7街38號 B1'
    }
  },
  ss6: {
    name: 'HATCHINGROOM',
    addr: {
      en: '33 Seongsuil-ro 6-gil, Seongdong-gu, Seoul 1F',
      zhCN: '首尔城东区圣水一路6街33号 1F',
      zhTW: '首爾城東區聖水一路6街33號 1F'
    }
  },
  ss7: {
    name: 'FOGSY',
    addr: {
      en: '24-11 Achasan-ro 5-gil, Seongdong-gu, Seoul 2F',
      zhCN: '首尔城东区峨嵯山路5街24-11号 2F',
      zhTW: '首爾城東區峨嵯山路5街24-11號 2F'
    }
  }
};

/* 화면 글귀 — 번역 PPT 의 글상자에서 그대로 옮겼습니다 */
var UI = {
  stampTour: { en: 'SEONGSU STAMP TOUR', zhCN: '圣水集章之旅', zhTW: '聖水集章之旅' },
  tagline: {
    en: 'COLLECT 3 STAMPS & GET A GIFT',
    zhCN: '集齐3个印章换取纪念品。',
    zhTW: '集齊3個印章換取禮品。'
  },
  guideBtn: { en: 'GUIDE', zhCN: '说明', zhTW: '說明' },
  mapBtn: { en: 'MAP', zhCN: '地图', zhTW: '地圖' },
  scanBtn: { en: 'SCAN QR CODE', zhCN: '请扫描二维码', zhTW: '請掃描QR碼' },
  guideLead: {
    en: 'Choose any 3 of the 7 stops and collect your stamps.\nTap a stop to see its address.',
    zhCN: '请从7个地点中任选3处收集印章。点击地点即可查看地址。',
    zhTW: '請從7個地點中任選3處，收集印章。點擊地點即可顯示地址。'
  },
  mapLead: {
    en: 'Find and scan the QR code at each stop.',
    zhCN: '找到各地点的二维码后并扫描。',
    zhTW: '找到各地點的QR碼後並掃描。'
  }
};

var cfg = JSON.parse(fs.readFileSync(FILE, 'utf8'));

cfg.spots.forEach(function (s) {
  var d = SPOTS[s.id];
  if (!d) { console.error('표에 없는 거점: ' + s.id); process.exit(1); }
  // 이름은 세 말이 같습니다 — 고유명사라 영문 그대로
  s.name = { ko: s.name && s.name.ko, en: d.name, zhCN: d.name, zhTW: d.name };
  s.addr = d.addr;
});

cfg.ui = UI;
cfg.checkout = { at: 3, desk: { ko: '무신사 스테이션 성수', en: 'MUSINSA STATION SEONGSU' } };
cfg.langs = ['en', 'zhCN', 'zhTW'];
cfg.langNames = { en: 'English', zhCN: '中文(简体)', zhTW: '中文(繁體)' };
cfg.defaultLang = 'en';
delete cfg._번역;
cfg._주의 = '주소는 1·2번만 디자인 화면에서 직접 확인했습니다. 나머지는 번역 PPT 의 목록 차례를 따랐고, 영문 주소는 중문을 도로명 규칙대로 옮긴 것입니다 — 확인 부탁드립니다.';

console.log('거점');
cfg.spots.forEach(function (s) {
  console.log('  ' + String(s.order).padStart(2, '0') + '  ' + (s.name.en + '                            ').slice(0, 28) + s.addr.en);
});
console.log('\n화면 글귀 ' + Object.keys(cfg.ui).length + '칸 · 선물 ' + cfg.checkout.at + '개째 · 체크아웃 ' + cfg.checkout.desk.en);

/* 이 대본은 v0.2 번역본으로 만든 것입니다.
   그 뒤 2026-11-09 「성수_스탬프_수정사항_1차」와 v0.4 번역본으로 손본 것이 있어서,
   그대로 다시 쓰면 주소(서울특별시)·거점명(KOREA CHECK IN RECEPTION)·주소 단추가 되돌아갑니다.
   그래서 쓰기를 한 겹 더 막아 뒀습니다. */
if (WRITE && process.argv.indexOf('--되돌려도좋음') < 0) {
  console.log('');
  console.log('이 대본은 v0.2 내용이라 1차 수정사항을 되돌립니다. 정말 쓰려면 --되돌려도좋음 도 함께 붙이세요.');
  process.exit(1);
}

if (!WRITE) { console.log('\n(아직 쓰지 않았습니다. --쓰기 를 붙이세요)'); process.exit(0); }
fs.writeFileSync(FILE, JSON.stringify(cfg, null, 2) + '\n', 'utf8');
console.log('config/seongsu.json 을 고쳤습니다');
