#include <stdio.h>
#include <assert.h>
#include "../engine/world.h"
int main(void){
 uint32_t hash=2166136261u;
 for(int y=-2048;y<2048;y+=17)for(int x=-2048;x<2048;x+=19){hash^=at_base(1709123u,x,y);hash*=16777619u;}
 assert(at_chunk(1709123u,-32768,-32768)==1024);
 assert(at_chunk(1709123u,32768,0)==0);
 at_set_player(1048575,0,0,0,0,0,0);
 assert(at_apply(AT_MOVE,1,0,0,at_base(1709123u,0,0),0)==AT_RANGE);
 printf("%u\n",hash);return 0;
}
