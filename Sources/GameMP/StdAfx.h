#include <Engine/Engine.h>
#include <GameMP/Game.h>
#include <GameMP/SEColors.h>

/* rcg10042001 protect against Visual C-isms. */
#ifdef _MSC_VER
#define DECL_DLL _declspec(dllimport)
#endif

#ifdef PLATFORM_UNIX
#define DECL_DLL 
#endif

#include <EntitiesMP/Global.h>
#include <EntitiesMP/Common/Common.h>
#include <EntitiesMP/Common/GameInterface.h>
// [Cecil] 2021-06-19: Bot Mod
#include "Bots/_BotMod.h"
#undef DECL_DLL
