#ifndef AGENT_TOWN_WORLD_H
#define AGENT_TOWN_WORLD_H
#include <stdint.h>
#define AT_VERSION 1u
#define AT_LIMIT 1048576
#define AT_CHUNK 32
/* Wire tile: biome | ground<<8 | object<<16 | remaining_hits<<24. */
enum { AT_FOREST=1,AT_BEACH,AT_OCEAN,AT_VOLCANIC,AT_JUNGLE };
enum { AT_GRASS=1,AT_SAND,AT_WATER,AT_BASALT,AT_LAVA,AT_DIRT };
enum { AT_EMPTY=0,AT_PINE,AT_OAK,AT_PALM,AT_JUNGLE_TREE,AT_ROCK,AT_IRON,AT_FIBER,
 AT_WOOD_WALL=16,AT_STONE_WALL,AT_FLOOR,AT_BRIDGE };
enum { AT_MOVE=1,AT_HARVEST,AT_BUILD,AT_REMOVE };
enum { AT_OK=0,AT_BAD_ACTION,AT_RANGE,AT_BLOCKED,AT_NO_RESOURCE,AT_OCCUPIED,AT_COST,AT_BAD_SITE,AT_FULL };
typedef struct { int32_t x,y; uint32_t wood,stone,ore,fiber,revision; } ATPlayer;
uint32_t at_version(void);
uint32_t at_base(uint32_t seed,int32_t x,int32_t y);
uint32_t at_variant(uint32_t seed,int32_t x,int32_t y);
uint32_t at_chunk(uint32_t seed,int32_t cx,int32_t cy);
uint32_t *at_chunk_data(void);
uint32_t at_walkable(uint32_t tile);
void at_set_player(int32_t x,int32_t y,uint32_t wood,uint32_t stone,uint32_t ore,uint32_t fiber,uint32_t revision);
ATPlayer *at_player_data(void);
uint32_t at_apply(uint32_t action,int32_t dx,int32_t dy,uint32_t structure,uint32_t target,uint32_t occupied);
uint32_t at_result_tile(void);
#endif
