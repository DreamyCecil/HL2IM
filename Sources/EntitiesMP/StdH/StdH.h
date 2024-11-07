#include <Engine/Engine.h>
#include <GameMP/SessionProperties.h>
#include <GameMP/PlayerSettings.h>

// [Cecil] Property type for TIME
#define ENGINE_SPECIFIC_EPT_TIME CEntityProperty::EPT_FLOAT

// [Cecil] Property definition
#define ENGINE_SPECIFIC_PROP_DEF(_Type, _EnumPtr, _ID, _Offset, _Name, _Shortcut, _Variable, _Color, _Flags) \
  CEntityProperty(_Type, _EnumPtr, _ID, _Offset, _Name, _Shortcut, _Color, _Flags)

/* rcg10042001 protect against Visual C-isms. */
#ifdef _MSC_VER
#define DECL_DLL _declspec(dllexport)
#endif

#ifdef PLATFORM_UNIX
#define DECL_DLL 
#endif

// [Cecil] Extras
#include <XGizmo/Entities/BaseClasses.h>
#include <XGizmo/Objects/EntityRefList.h>
#include <XGizmo/Objects/SymbolPtr.h>
#include <XGizmo/Objects/SyncedEntityPtr.h>

// [Cecil] New physics
#include <EntitiesMP/Cecil/Collision/WorldRayCasting.h>
#include <EntitiesMP/Cecil/ODE/API.h>
#include <EntitiesMP/Cecil/ODE/ODEBase.h>

#include <EntitiesMP/Mod/Base/MovableEntity.h>
#include <EntitiesMP/Mod/Base/MovableModelEntity.h>
#include <EntitiesMP/Mod/Base/MovableBrushEntity.h>
#include <EntitiesMP/Mod/Base/PlayerEntity.h>

#include "..\Global.h"
#include "..\Common\Flags.h"
#include "..\Common\Common.h"
#include "..\Common\Particles.h"
#include "..\Common\EmanatingParticles.h"
#include "..\Common\GameInterface.h"
