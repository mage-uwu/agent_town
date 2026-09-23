// Action-space poses. +Z faces forward. The same skeleton is projected in every view.
export const ACTIONS = ['idle', 'sword_swing', 'pickaxe_swing'];
export const ACTION_FRAMES = 8;
export const ACTION_FPS = 8;
export const ACTION_SIZE = 64;
export const ACTION_ANCHOR = {x:32, y:54};
export const PHASES = ['Ready', 'Anticipation', 'Wind-up', 'Hold', 'Strike', 'Follow-through', 'Recovery', 'Ready'];
export function unit(vector) {const n=Math.hypot(...vector);return vector.map(x=>x/n);}
export function cross(a,b) {return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];}
export function actionTool(action, equipped) {return action==='sword_swing'?'sword':action==='pickaxe_swing'?'pickaxe':equipped;}
export function rigPose(action, frame, width) {
  const f=((Math.floor(frame)%8)+8)%8;
  const idle={hand:[width+2,12,3],axis:unit([.1,1,.12]),bob:0,reach:0};
  if(action==='idle')return idle;
  const sword=[
    [[10,16,4],[.45,.8,.3],0], [[11,19,1],[.45,.8,-.45],0],
    [[10,24,-2],[.1,.8,-.6],0], [[9,25,-3],[-.2,.9,-.35],0],
    [[7,19,7],[-.65,.1,.75],1], [[3,14,7],[-.8,-.25,.5],2],
    [[7,14,5],[-.2,.8,.5],1], [[10,16,4],[.45,.8,.3],0],
  ];
  const pickaxe=[
    [[8,17,5],[0,.95,.3],0], [[8,21,3],[0,1,-.1],0],
    [[7,26,-1],[0,.9,-.45],0], [[7,27,-2],[0,.8,-.6],0],
    [[7,22,5],[0,.25,.97],1], [[6,16,7],[0,-.6,.8],2],
    [[7,18,6],[0,.5,.86],1], [[8,17,5],[0,.95,.3],0],
  ];
  const [hand,axis,bob]=(action==='sword_swing'?sword:pickaxe)[f];
  return {hand:[hand[0]+width-7,hand[1],hand[2]],axis:unit(axis),bob,reach:f};
}
