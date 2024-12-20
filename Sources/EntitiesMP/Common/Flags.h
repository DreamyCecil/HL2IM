#ifndef SE_INCL_FLAGS_H
#define SE_INCL_FLAGS_H
#ifdef PRAGMA_ONCE
  #pragma once
#endif

// collision flags
#define ECBI_BRUSH              (1UL<<0)
#define ECBI_MODEL              (1UL<<1)
#define ECBI_PROJECTILE_MAGIC   (1UL<<2)
#define ECBI_PROJECTILE_SOLID   (1UL<<3)
#define ECBI_ITEM               (1UL<<4)
#define ECBI_CORPSE             (1UL<<5)
#define ECBI_MODEL_HOLDER       (1UL<<6)
#define ECBI_CORPSE_SOLID       (1UL<<7)
#define ECBI_PLAYER             (1UL<<8)
#define ECBI_PHYSOBJECT         (1UL<<9) // [Cecil] Physical objects

// standard flag combinations:

/*
 *  COLLISION COMBINATIONS
 */
#define ECF_IMMATERIAL (0UL)

// brush
#define ECF_BRUSH ( \
  ((ECBI_MODEL|ECBI_PROJECTILE_MAGIC|ECBI_PROJECTILE_SOLID|ECBI_ITEM|ECBI_CORPSE|ECBI_CORPSE_SOLID)<<ECB_TEST) |\
  ((ECBI_BRUSH)<<ECB_IS))

// model
#define ECF_MODEL ( \
  ((ECBI_MODEL|ECBI_BRUSH|ECBI_PROJECTILE_MAGIC|ECBI_PROJECTILE_SOLID|ECBI_ITEM|ECBI_MODEL_HOLDER|ECBI_CORPSE_SOLID)<<ECB_TEST) |\
  ((ECBI_MODEL)<<ECB_IS))

// [Cecil] Throwable projectle
#define ECF_THROWABLE ( \
  ((ECBI_MODEL|ECBI_BRUSH|ECBI_PROJECTILE_MAGIC|ECBI_PROJECTILE_SOLID|ECBI_ITEM|ECBI_MODEL_HOLDER|ECBI_CORPSE_SOLID)<<ECB_TEST) |\
  ((ECBI_PLAYER)<<ECB_PASS) |\
  ((ECBI_MODEL)<<ECB_IS))

// projectile magic
#define ECF_PROJECTILE_MAGIC ( \
  ((ECBI_MODEL|ECBI_BRUSH|ECBI_CORPSE|ECBI_CORPSE_SOLID|ECBI_MODEL_HOLDER)<<ECB_TEST) |\
  ((ECBI_PROJECTILE_MAGIC)<<ECB_IS) |\
  ((ECBI_MODEL)<<ECB_PASS))

// projectile solid
#define ECF_PROJECTILE_SOLID ( \
  ((ECBI_MODEL|ECBI_BRUSH|ECBI_PROJECTILE_SOLID|ECBI_CORPSE|ECBI_CORPSE_SOLID|ECBI_MODEL_HOLDER)<<ECB_TEST) |\
  ((ECBI_PROJECTILE_SOLID)<<ECB_IS) |\
  ((ECBI_MODEL|ECBI_PROJECTILE_SOLID)<<ECB_PASS) )

// item
#define ECF_ITEM ( \
  ((ECBI_MODEL|ECBI_BRUSH)<<ECB_TEST) |\
  ((ECBI_MODEL)<<ECB_PASS) |\
  ((ECBI_ITEM)<<ECB_IS))

// touch model
#define ECF_TOUCHMODEL ( \
  ((ECBI_MODEL)<<ECB_TEST) |\
  ((ECBI_MODEL)<<ECB_PASS) |\
  ((ECBI_ITEM)<<ECB_IS))

// corpse
#define ECF_CORPSE ( \
  ((ECBI_BRUSH|ECBI_PROJECTILE_MAGIC|ECBI_PROJECTILE_SOLID)<<ECB_TEST) |\
  ((ECBI_CORPSE)<<ECB_IS))

// large corpse that is not passable, but doesn't collide with itself
#define ECF_CORPSE_SOLID ( \
  ((ECBI_BRUSH|ECBI_MODEL|ECBI_MODEL_HOLDER|ECBI_PROJECTILE_MAGIC|ECBI_PROJECTILE_SOLID)<<ECB_TEST) |\
  ((ECBI_CORPSE_SOLID)<<ECB_IS))

// model holder
#define ECF_MODEL_HOLDER ( \
  ((ECBI_MODEL|ECBI_CORPSE|ECBI_CORPSE_SOLID|ECBI_PROJECTILE_MAGIC|ECBI_PROJECTILE_SOLID|ECBI_ITEM|ECBI_MODEL_HOLDER)<<ECB_TEST) |\
  ((ECBI_MODEL_HOLDER)<<ECB_IS))

// debris
#define ECF_DEBRIS ( \
  ((ECBI_BRUSH)<<ECB_TEST) |\
  ((ECBI_CORPSE)<<ECB_IS))

// flame
#define ECF_FLAME ( \
  ((ECBI_MODEL|ECBI_CORPSE_SOLID)<<ECB_TEST) |\
  ((ECBI_PROJECTILE_MAGIC)<<ECB_IS) |\
  ((ECBI_MODEL|ECBI_CORPSE_SOLID)<<ECB_PASS) )

// camera
#define ECF_CAMERA ( \
  ((ECBI_BRUSH)<<ECB_TEST) |\
  ((ECBI_MODEL)<<ECB_IS) |\
  ((ECBI_BRUSH)<<ECB_PASS) )

// [Cecil] Collision flags for physical objects
#define ECF_PHYS_TESTALL         ((ECBI_BRUSH | ECBI_PROJECTILE_MAGIC | ECBI_PROJECTILE_SOLID | ECBI_MODEL | ECBI_PLAYER) << ECB_TEST) // Test against all entities
#define ECF_PHYS_TESTPROJECTILES ((ECBI_BRUSH | ECBI_PROJECTILE_MAGIC | ECBI_PROJECTILE_SOLID) << ECB_TEST) // Only test against projectiles
#define ECF_PHYS_ISOBJECT        (((ECBI_BRUSH | ECBI_PHYSOBJECT) << ECB_PASS) | (ECBI_PHYSOBJECT) << ECB_IS) // Generic physics object that should pass through itself and brushes during engine physics
#define ECF_PHYS_ISMODEL         (ECF_PHYS_ISOBJECT | ((ECBI_MODEL) << ECB_IS)) // Physical model
#define ECF_PHYS_ISBRUSH         (ECF_PHYS_ISOBJECT | ((ECBI_BRUSH) << ECB_IS)) // Physical brush

/*
 *  PHYSIC COMBINATIONS
 */

// [Cecil] Made all physics flags collide with custom shaped collisions

// model that walks around on feet (CMovableModelEntity)
#define EPF_MODEL_WALKING (EPF_COLLIDEWITHCUSTOM | EPF_COLLIDEWITHCUSTOM_EXCL | \
  EPF_ONBLOCK_CLIMBORSLIDE|EPF_ORIENTEDBYGRAVITY|\
  EPF_TRANSLATEDBYGRAVITY|EPF_PUSHABLE|EPF_MOVABLE)

// model that flies around with wings or similar (CMovableModelEntity)
#define EPF_MODEL_FLYING (EPF_COLLIDEWITHCUSTOM | EPF_COLLIDEWITHCUSTOM_EXCL | \
  EPF_ONBLOCK_SLIDE|EPF_ORIENTEDBYGRAVITY|EPF_PUSHABLE|EPF_MOVABLE)

// model that flies around with no gravity orientation (CMovableModelEntity)
#define EPF_MODEL_FREE_FLYING (EPF_COLLIDEWITHCUSTOM | EPF_COLLIDEWITHCUSTOM_EXCL | \
  EPF_ONBLOCK_SLIDE|EPF_PUSHABLE|EPF_MOVABLE)

// model that bounce around (CMovableModelEntity)
#define EPF_MODEL_BOUNCING (EPF_COLLIDEWITHCUSTOM | EPF_COLLIDEWITHCUSTOM_EXCL | \
  EPF_ONBLOCK_BOUNCE|EPF_PUSHABLE|EPF_MOVABLE|EPF_TRANSLATEDBYGRAVITY)

// projectile that flies around with no gravity orientation (CMovableModelEntity)
#define EPF_PROJECTILE_FLYING (EPF_COLLIDEWITHCUSTOM | EPF_COLLIDEWITHCUSTOM_EXCL | \
  EPF_ONBLOCK_STOPEXACT|EPF_PUSHABLE|EPF_MOVABLE)

// model that slides on brushes (CMovableModelEntity)
#define EPF_MODEL_SLIDING (EPF_COLLIDEWITHCUSTOM | EPF_COLLIDEWITHCUSTOM_EXCL | \
  EPF_ONBLOCK_SLIDE|EPF_ORIENTEDBYGRAVITY|EPF_TRANSLATEDBYGRAVITY|\
  EPF_PUSHABLE|EPF_MOVABLE)

// model that fall (CMovableModelEntity)
#define EPF_MODEL_FALL (EPF_COLLIDEWITHCUSTOM | EPF_COLLIDEWITHCUSTOM_EXCL | \
  EPF_ONBLOCK_SLIDE|EPF_PUSHABLE|EPF_MOVABLE|EPF_TRANSLATEDBYGRAVITY)

// model that is fixed in one place and cannot be moved (CEntity)
#define EPF_MODEL_FIXED (0UL)

// model that walks around switches to this when dead (CMovableModelEntity)
#define EPF_MODEL_CORPSE (EPF_COLLIDEWITHCUSTOM | EPF_COLLIDEWITHCUSTOM_EXCL | \
  EPF_ONBLOCK_SLIDE|EPF_ORIENTEDBYGRAVITY|EPF_TRANSLATEDBYGRAVITY|\
  EPF_PUSHABLE|EPF_MOVABLE)

// model that is not physically present - just a decoration (CEntity)
#define EPF_MODEL_IMMATERIAL (0UL)

// brush that moves around absolute (CMovableBrushEntity)
#define EPF_BRUSH_MOVING (\
  EPF_ONBLOCK_PUSH|EPF_RT_SYNCHRONIZED|\
  EPF_ABSOLUTETRANSLATE|EPF_NOACCELERATION|EPF_MOVABLE)

// brush that is fixed in one place and cannot be moved (CEntity)
#define EPF_BRUSH_FIXED  (0UL)

// brush that is not physically present - just a decoration (CEntity)
#define EPF_BRUSH_IMMATERIAL (0UL)



#endif  /* include-once check. */

