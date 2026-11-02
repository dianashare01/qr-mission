/* 관리자 확인코드를 흩뜨린 값으로 바꿔 줍니다.
 *
 *   node _tools/admin-code.js 261212
 *
 * 나온 값을 config/kcheckin.json 의 admin.codeKey 에 넣으세요.
 * 설정 파일은 홈페이지에 그대로 올라가므로 숫자를 적어 두지 않습니다.
 * 여섯 자리는 백만 가지뿐이라 작정하고 맞혀 보면 뚫립니다 — 눈에 안 띄게 할 뿐,
 * 자물쇠는 아닙니다. 선물은 직원이 직접 건네므로 그 정도면 됩니다.
 */

function one(s, salt) {
  var h = 2166136261;
  s = salt + s;
  for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  h ^= h >>> 15; h = Math.imul(h, 2246822507);
  h ^= h >>> 13; h = Math.imul(h, 3266489909);
  h ^= h >>> 16;
  return ('0000000' + (h >>> 0).toString(16)).slice(-8);
}

var code = (process.argv[2] || '').trim();
if (!/^[0-9]{6}$/.test(code)) {
  console.log('여섯 자리 숫자를 적어 주세요.  보기)  node _tools/admin-code.js 261212');
  process.exit(1);
}
console.log(one(code, 'kchk1:') + one(code, 'kchk2:'));
