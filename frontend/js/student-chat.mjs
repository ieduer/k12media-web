// Caller must obtain membership only after source-verified student/exam access.
// No exam images, grades, names, source cookies or passwords enter this module.
export function mountExamDiscussion(container, { membership, ioFactory = globalThis.io } = {}) {
  if (!(container instanceof HTMLElement) || typeof ioFactory !== 'function' || typeof membership !== 'string' || membership.length > 1024)
    throw new Error('discussion_unavailable');
  container.replaceChildren();
  const heading=document.createElement('h2');heading.textContent='本次考试 · 匿名讨论';
  const note=document.createElement('p');note.textContent='仅本次考试的已登录学生可进入。对其他同学显示临时匿名名；这不等同于对运营方匿名。聊天记录整点清空，不自动分享你的试卷和成绩。请勿发布姓名、联系方式或他人隐私。';
  const status=document.createElement('p');status.role='status';status.textContent='正在连接…';
  const list=document.createElement('ol');list.setAttribute('aria-label','考试讨论');list.setAttribute('aria-live','polite');
  const form=document.createElement('form'),input=document.createElement('textarea'),button=document.createElement('button');
  input.maxLength=2000;input.placeholder='讨论题目或解题思路（最多 2000 字）';input.setAttribute('aria-label','讨论内容');
  button.type='submit';button.textContent='发送';button.disabled=true;
  form.append(input,button);container.append(heading,note,status,list,form);
  const socket=ioFactory('https://chat.bdfz.net/exam',{transports:['websocket'],auth:{membership},reconnection:false});
  membership=null;let connected=false;const seen=new Set();
  function append(row){
    if(!row||typeof row.id!=='string'||seen.has(row.id)||typeof row.text!=='string'||typeof row.name!=='string')return;
    seen.add(row.id);const item=document.createElement('li'),name=document.createElement('strong'),text=document.createElement('p');item.dataset.messageId=row.id;
    name.textContent=row.name;text.textContent=row.text;item.append(name,text);list.append(item);
    while(list.children.length>200){seen.delete(list.firstElementChild.dataset.messageId);list.firstElementChild.remove();}
  }
  socket.on('exam_ready',data=>{connected=true;button.disabled=false;status.textContent=`你在本次考试中显示为 ${data.name}。`;});
  socket.on('exam_history',rows=>{if(Array.isArray(rows))rows.forEach(append);});
  socket.on('exam_message',append);
  socket.on('exam_wiped',()=>{list.replaceChildren();seen.clear();status.textContent='已到整点，本小时聊天记录已清空。';});
  socket.on('exam_error',()=>{status.textContent='讨论暂时不可用，请稍后重新进入。';});
  socket.on('connect_error',()=>{connected=false;button.disabled=true;status.textContent='未能进入讨论。请刷新本人考试资料后重新进入。';});
  socket.on('disconnect',()=>{connected=false;button.disabled=true;status.textContent='讨论连接已结束。重新进入前会再次核验考试权限。';});
  form.addEventListener('submit',event=>{
    event.preventDefault();const text=input.value.trim();if(!connected||!text||Array.from(text).length>2000)return;
    button.disabled=true;const clientId=crypto.randomUUID();
    socket.timeout(10000).emit('exam_message',{clientId,text},(error,result)=>{
      button.disabled=!connected;
      if(error||!result||result.code==='delivery_unknown'){status.textContent='发送状态未知。请先核对讨论记录，避免重复发送。';return;}
      if(!result.ok){status.textContent=result.code==='rate_limited'?'发送过于频繁，请稍候。':'消息未发送，请重新进入讨论后再试。';return;}
      input.value='';status.textContent=result.duplicate?'此消息已接收，无需重复发送。':'已发送。';
    });
  });
  return ()=>{socket.auth={};socket.disconnect();seen.clear();input.value='';container.replaceChildren();};
}
