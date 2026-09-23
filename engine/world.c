#include "world.h"
/* Portable C11, freestanding: no heap, libc, OS, clock, floating point, or I/O.
   All mutable scratch belongs to an engine instance (one WASM instance per authority).
   Coordinate hashing and integer interpolation are identical on native and WASM. */
static ATPlayer player;
static uint32_t chunk[AT_CHUNK*AT_CHUNK],result_tile;
static uint32_t mix(uint32_t a) { a^=a>>16;a*=0x7feb352du;a^=a>>15;a*=0x846ca68bu;return a^(a>>16); }
uint32_t at_variant(uint32_t s,int32_t x,int32_t y) {return mix(s^mix((uint32_t)x+0x9e3779b9u)^mix((uint32_t)y+0x85ebca6bu));}
static int32_t floor_div(int32_t a,int32_t b){int32_t q=a/b;return q-(a%b<0);}
static uint32_t smooth(uint32_t t){return (uint32_t)(((uint64_t)t*t*(196608u-2u*t))>>32);}
static uint32_t lerp(uint32_t a,uint32_t b,uint32_t t){return (uint32_t)(((uint64_t)a*(65536u-t)+(uint64_t)b*t)>>16);}
static uint32_t noise(uint32_t s,int32_t x,int32_t y,int32_t scale){
 int32_t gx=floor_div(x,scale),gy=floor_div(y,scale);
 uint32_t tx=smooth((uint32_t)(x-gx*scale)*65536u/(uint32_t)scale),ty=smooth((uint32_t)(y-gy*scale)*65536u/(uint32_t)scale);
 uint32_t a=at_variant(s,gx,gy)&65535u,b=at_variant(s,gx+1,gy)&65535u,c=at_variant(s,gx,gy+1)&65535u,d=at_variant(s,gx+1,gy+1)&65535u;
 return lerp(lerp(a,b,tx),lerp(c,d,tx),ty);
}
static uint32_t pack(uint32_t b,uint32_t g,uint32_t o,uint32_t hp){return b|(g<<8)|(o<<16)|(hp<<24);}
static int valid(int32_t x,int32_t y){return x>=-AT_LIMIT&&x<AT_LIMIT&&y>=-AT_LIMIT&&y<AT_LIMIT;}
uint32_t at_version(void){return AT_VERSION;}
uint32_t at_base(uint32_t seed,int32_t x,int32_t y){
 if(!valid(x,y))return pack(AT_OCEAN,AT_WATER,0,0);
 uint32_t h=at_variant(seed,x,y),land=(noise(seed^11u,x,y,384)*3u+noise(seed^72u,x,y,96))/4u;
 uint32_t heat=noise(seed^91u,x,y,640),wet=noise(seed^171u,x,y,192);
 uint32_t b,g,o=0,hp=0;
 /* A small, deterministic starting clearing; resources at known cardinal landmarks. */
 if(x>=-12&&x<=12&&y>=-12&&y<=12){
  b=AT_FOREST;g=AT_GRASS;
  if(x==4&&y==0){o=AT_OAK;hp=3;}else if(x==-4&&y==0){o=AT_ROCK;hp=4;}
  else if(x==0&&y==4){o=AT_IRON;hp=5;}else if(x==0&&y==-4){o=AT_FIBER;hp=1;}
  else if((x>6||x<-6||y>6||y<-6)&&h%8u==0){o=AT_PINE;hp=3;}
  return pack(b,g,o,hp);
 }
 if(land<26400u){b=AT_OCEAN;g=AT_WATER;}
 else if(land<30000u){b=AT_BEACH;g=AT_SAND;if(h%71u==0){o=AT_PALM;hp=3;}else if(h%53u==0){o=AT_ROCK;hp=3;}}
 else if(heat>43500u&&wet<34000u){b=AT_VOLCANIC;g=AT_BASALT;
  if(noise(seed^412u,x,y,24)>47800u)g=AT_LAVA;
  else if(h%11u==0){o=AT_IRON;hp=5;}else if(h%7u==0){o=AT_ROCK;hp=4;}}
 else if(wet>36000u&&heat>29000u){b=AT_JUNGLE;g=AT_GRASS;
  if(h%5u==0){o=AT_JUNGLE_TREE;hp=4;}else if(h%19u==0){o=AT_FIBER;hp=2;}else if(h%73u==0){o=AT_ROCK;hp=3;}}
 else {b=AT_FOREST;g=AT_GRASS;
  if(h%10u==0){o=heat<26000u?AT_PINE:AT_OAK;hp=3;}else if(h%41u==0){o=AT_ROCK;hp=3;}else if(h%31u==0){o=AT_FIBER;hp=1;}}
 return pack(b,g,o,hp);
}
uint32_t at_chunk(uint32_t seed,int32_t cx,int32_t cy){
 if(cx<-AT_LIMIT/32||cx>=AT_LIMIT/32||cy<-AT_LIMIT/32||cy>=AT_LIMIT/32)return 0;
 for(int32_t y=0;y<32;y++)for(int32_t x=0;x<32;x++)chunk[y*32+x]=at_base(seed,cx*32+x,cy*32+y);
 return 1024;
}
uint32_t *at_chunk_data(void){return chunk;}
ATPlayer *at_player_data(void){return &player;}
uint32_t at_result_tile(void){return result_tile;}
uint32_t at_walkable(uint32_t t){uint32_t g=(t>>8)&255u,o=(t>>16)&255u;return o==AT_BRIDGE||(g!=AT_WATER&&g!=AT_LAVA&&(o==0||o==AT_FIBER||o==AT_FLOOR));}
void at_set_player(int32_t x,int32_t y,uint32_t w,uint32_t s,uint32_t o,uint32_t f,uint32_t r){player=(ATPlayer){x,y,w,s,o,f,r};}
uint32_t at_apply(uint32_t action,int32_t dx,int32_t dy,uint32_t structure,uint32_t target,uint32_t occupied){
 result_tile=target;
 if(!valid(player.x,player.y)||dx<-1||dx>1||dy<-1||dy>1||(!dx&&!dy))return AT_RANGE;
 int32_t x=player.x+dx,y=player.y+dy;if(!valid(x,y))return AT_RANGE;
 uint32_t biome=target&255u,g=(target>>8)&255u,o=(target>>16)&255u,hp=target>>24;
 if(biome<1||biome>5||g<1||g>6)return AT_BAD_SITE;
 if(occupied)return AT_OCCUPIED;
 if(action==AT_MOVE){if(dx&&dy)return AT_RANGE;if(!at_walkable(target))return AT_BLOCKED;player.x=x;player.y=y;}
 else if(action==AT_HARVEST){
  if(o<AT_PINE||o>AT_FIBER||!hp)return AT_NO_RESOURCE;
  uint32_t *resource=o<=AT_JUNGLE_TREE?&player.wood:o==AT_ROCK?&player.stone:o==AT_IRON?&player.ore:&player.fiber;
  uint32_t amount=o<=AT_JUNGLE_TREE?4u:o==AT_IRON?3u:4u;
  if(hp==1&&*resource>9999u-amount)return AT_FULL;
  if(--hp==0){*resource+=amount;o=0;}result_tile=pack(biome,g,o,hp);
 }else if(action==AT_BUILD){
  if(o!=0)return AT_BAD_SITE;
  if(structure<AT_WOOD_WALL||structure>AT_BRIDGE)return AT_BAD_ACTION;
  if(g==AT_LAVA||(structure==AT_BRIDGE?g!=AT_WATER:g==AT_WATER))return AT_BAD_SITE;
  uint32_t cost=structure==AT_FLOOR?1u:structure==AT_BRIDGE?3u:2u;
  uint32_t *resource=structure==AT_STONE_WALL?&player.stone:&player.wood;
  if(*resource<cost)return AT_COST;
  *resource-=cost;result_tile=pack(biome,g,structure,1);
 }else if(action==AT_REMOVE){
  if(o<AT_WOOD_WALL||o>AT_BRIDGE)return AT_NO_RESOURCE;
  uint32_t *resource=o==AT_STONE_WALL?&player.stone:&player.wood;
  if(*resource>=9999)return AT_FULL;
  *resource+=1;result_tile=pack(biome,g,0,0);
 }else return AT_BAD_ACTION;
 player.revision++;return AT_OK;
}
