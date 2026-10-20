import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
const pattern=/^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert|release)：\S[^\r\n]*$/u;
function validate(message){const title=message.split(/\r?\n/)[0];return pattern.test(title)&&/\p{Script=Han}/u.test(title.split('：').slice(1).join('：'))}
function check(message,label){if(!validate(message))throw new Error(`${label}：标题必须为英文类型＋全角冒号＋中文描述，例如 fix：修复重复导入。实际标题：${message.split(/\r?\n/)[0]}`)}
function git(...args){return execFileSync('git',args,{encoding:'utf8'}).trim()}
try{
 const [mode,arg]=process.argv.slice(2);
 if(mode==='--self-test'){
  for(const title of ['fix：修复重复导入','docs：补充 API 说明','release：准备发布 0.1.0'])assert(validate(title));
  for(const title of ['fix: 修复重复导入','fix：fix issue','feat(ui)：添加入口','修改：新增页面','docs：','docs： 更新文档','Merge pull request #1'])assert(!validate(title));
  assert(validate('test：补充事件导入测试\n\n验证重复事件不新增版本'));
  console.log('Commit title tests passed.');
 }else if(mode==='--file'){check(fs.readFileSync(arg,'utf8'),'提交信息')}
 else if(mode==='--ci'){
  const {BASE_SHA:base,HEAD_SHA:head,PR_TITLE:title}=process.env;
  if(title)check(title,'PR 标题');
  if(!/^[a-f0-9]{40,64}$/.test(head||''))throw new Error('Invalid HEAD_SHA');
  if(base&&!/^[a-f0-9]{40,64}$/.test(base))throw new Error('Invalid BASE_SHA');
  const commits=base&&!/^0+$/.test(base)?git('rev-list',`${base}..${head}`).split('\n').filter(Boolean):[head];
  for(const id of commits)check(git('show','-s','--format=%B',id),id.slice(0,8));
  console.log(`Validated ${commits.length} new commit titles.`);
 }else{throw new Error('Usage: --file <message-file> | --self-test | --ci')}
}catch(error){console.error(error.message);process.exit(1)}
