/**
 * 测试 Sidekick 链接解析功能
 */

// 模拟链接解析逻辑
function parseSidekickLink(text) {
  const sidekickUrlMatch = text.match(/https?:\/\/sidekick\.fans\/([a-zA-Z0-9]+)/);
  if (sidekickUrlMatch) {
    return sidekickUrlMatch[1];
  }
  return null;
}

// 测试用例
const testCases = [
  {
    input: "https://sidekick.fans/cmahm5oy0001fl40m59hgr47g",
    expected: "cmahm5oy0001fl40m59hgr47g",
    description: "标准 HTTPS 链接"
  },
  {
    input: "http://sidekick.fans/cmahm5oy0001fl40m59hgr47g",
    expected: "cmahm5oy0001fl40m59hgr47g",
    description: "HTTP 链接"
  },
  {
    input: "https://sidekick.fans/abc123def456",
    expected: "abc123def456",
    description: "数字字母混合ID"
  },
  {
    input: "https://sidekick.fans/123456789",
    expected: "123456789",
    description: "纯数字ID"
  },
  {
    input: "https://sidekick.fans/abcdefghijklmnop",
    expected: "abcdefghijklmnop",
    description: "纯字母ID"
  },
  {
    input: "https://sidekick.fans/cmahm5oy0001fl40m59hgr47g?param=value",
    expected: "cmahm5oy0001fl40m59hgr47g",
    description: "带查询参数的链接"
  },
  {
    input: "https://sidekick.fans/cmahm5oy0001fl40m59hgr47g#section",
    expected: "cmahm5oy0001fl40m59hgr47g",
    description: "带锚点的链接"
  },
  {
    input: "https://sidekick.fans/cmahm5oy0001fl40m59hgr47g/",
    expected: "cmahm5oy0001fl40m59hgr47g",
    description: "带斜杠结尾的链接"
  },
  {
    input: "这是文本 https://sidekick.fans/cmahm5oy0001fl40m59hgr47g 其他文本",
    expected: "cmahm5oy0001fl40m59hgr47g",
    description: "链接在文本中间"
  },
  {
    input: "https://sidekick.fans/cmahm5oy0001fl40m59hgr47g 其他文本",
    expected: "cmahm5oy0001fl40m59hgr47g",
    description: "链接在文本开头"
  },
  {
    input: "其他文本 https://sidekick.fans/cmahm5oy0001fl40m59hgr47g",
    expected: "cmahm5oy0001fl40m59hgr47g",
    description: "链接在文本结尾"
  },
  {
    input: "https://example.com/cmahm5oy0001fl40m59hgr47g",
    expected: null,
    description: "非 Sidekick 域名"
  },
  {
    input: "https://sidekick.fans/",
    expected: null,
    description: "没有房间ID的链接"
  },
  {
    input: "https://sidekick.fans",
    expected: null,
    description: "只有域名的链接"
  },
  {
    input: "这不是一个链接",
    expected: null,
    description: "普通文本"
  },
  {
    input: "",
    expected: null,
    description: "空字符串"
  }
];

// 运行测试
function runTests() {
  console.log('🧪 开始测试 Sidekick 链接解析功能\n');
  
  let passed = 0;
  let failed = 0;
  
  testCases.forEach((testCase, index) => {
    const result = parseSidekickLink(testCase.input);
    const success = result === testCase.expected;
    
    if (success) {
      passed++;
      console.log(`✅ 测试 ${index + 1}: ${testCase.description}`);
    } else {
      failed++;
      console.log(`❌ 测试 ${index + 1}: ${testCase.description}`);
      console.log(`   输入: "${testCase.input}"`);
      console.log(`   期望: ${testCase.expected}`);
      console.log(`   实际: ${result}`);
    }
  });
  
  console.log(`\n📊 测试结果: ${passed} 通过, ${failed} 失败`);
  
  if (failed === 0) {
    console.log('🎉 所有测试通过！链接解析功能正常工作。');
  } else {
    console.log('⚠️  有测试失败，请检查链接解析逻辑。');
  }
}

// 测试正则表达式
function testRegex() {
  console.log('\n🔍 正则表达式测试');
  
  const regex = /https?:\/\/sidekick\.fans\/([a-zA-Z0-9]+)/;
  
  const testStrings = [
    "https://sidekick.fans/cmahm5oy0001fl40m59hgr47g",
    "http://sidekick.fans/abc123",
    "https://sidekick.fans/123456",
    "https://sidekick.fans/abcdef",
    "https://sidekick.fans/cmahm5oy0001fl40m59hgr47g?param=value",
    "https://sidekick.fans/cmahm5oy0001fl40m59hgr47g#section",
    "https://sidekick.fans/cmahm5oy0001fl40m59hgr47g/",
    "这是文本 https://sidekick.fans/cmahm5oy0001fl40m59hgr47g 其他文本"
  ];
  
  testStrings.forEach((str, index) => {
    const match = str.match(regex);
    if (match) {
      console.log(`✅ 匹配 ${index + 1}: "${str}" -> 房间ID: ${match[1]}`);
    } else {
      console.log(`❌ 不匹配 ${index + 1}: "${str}"`);
    }
  });
}

// 运行所有测试
if (require.main === module) {
  runTests();
  testRegex();
}

module.exports = {
  parseSidekickLink,
  runTests,
  testRegex
};
