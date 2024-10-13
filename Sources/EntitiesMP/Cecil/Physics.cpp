/* Copyright (c) 2024 Dreamy Cecil
This program is free software; you can redistribute it and/or modify
it under the terms of version 2 of the GNU General Public License as published by
the Free Software Foundation


This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License along
with this program; if not, write to the Free Software Foundation, Inc.,
51 Franklin Street, Fifth Floor, Boston, MA 02110-1301 USA. */

#include "StdH.h"
#include "Physics.h"

#include <EntitiesMP/PlayerWeapons.h>

// Various classes
#include <EntitiesMP/Mod/BetaEnemies/AntlionGuard.h>
#include <EntitiesMP/Mod/BetaEnemies/Merasmus.h>
#include <EntitiesMP/Mod/Radio.h>
#include <EntitiesMP/Mod/RollerMine.h>
#include <EntitiesMP/AirElemental.h>
#include <EntitiesMP/Beast.h>
#include <EntitiesMP/CannonRotating.h>
#include <EntitiesMP/CannonStatic.h>
#include <EntitiesMP/Elemental.h>
#include <EntitiesMP/ExotechLarva.h>
#include <EntitiesMP/MovingBrush.h>
#include <EntitiesMP/RollingStone.h>
#include <EntitiesMP/Scorpman.h>
#include <EntitiesMP/Summoner.h>
#include <EntitiesMP/Walker.h>
#include <EntitiesMP/Werebull.h>

static FLOAT3D _vHandle;
static CBrushPolygon *_pbpoNear;
static FLOAT _fNearDistance;
static FLOAT3D _vNearPoint;
static FLOATplane3D _plPlane;

class CActiveSector {
public:
  CBrushSector *as_pbsc;
};

static CStaticStackArray<CActiveSector> _aas;

static void AddSector(CBrushSector *pbsc) {
  // if not already active and in first mip of its brush
  if (pbsc->bsc_pbmBrushMip->IsFirstMip() && !(pbsc->bsc_ulFlags & BSCF_NEARTESTED)) {
    // add it to active sectors
    _aas.Push().as_pbsc = pbsc;
    pbsc->bsc_ulFlags |= BSCF_NEARTESTED;
  }
};

static void AddAllSectorsOfBrush(CBrush3D *pbr) {
  // get first mip
  CBrushMip *pbmMip = pbr->GetFirstMip();

  // skip if it has no brush mip for that mip factor
  if (pbmMip == NULL) {
    return;
  }

  // for each sector in the brush mip
  FOREACHINDYNAMICARRAY(pbmMip->bm_abscSectors, CBrushSector, itbsc) {
    // add the sector
    AddSector(itbsc);
  }
};

// GetNearestPolygon() but with portal polygons
void SearchThroughSectors_Portal(void) {
  // for each active sector (sectors are added during iteration!)
  for (INDEX ias = 0; ias < _aas.Count(); ias++) {
    CBrushSector *pbsc = _aas[ias].as_pbsc;

    // for each polygon in the sector
    {FOREACHINSTATICARRAY(pbsc->bsc_abpoPolygons, CBrushPolygon, itbpo) {
      CBrushPolygon &bpo = *itbpo;

      // find distance of the polygon plane from the handle
      const FLOATplane3D &plPolygon = bpo.bpo_pbplPlane->bpl_plAbsolute;
      FLOAT fDistance = plPolygon.PointDistance(_vHandle);

      // skip if it is behind the plane or further than nearest found
      if (fDistance < 0.0f || fDistance > _fNearDistance) {
        continue;
      }

      // find projection of handle to the polygon plane
      FLOAT3D vOnPlane = plPolygon.ProjectPoint(_vHandle);

      // skip if it is not in the bounding box of polygon
      const FLOATaabbox3D &boxPolygon = bpo.bpo_boxBoundingBox;
      const FLOAT EPSILON = 0.01f;
      if ((boxPolygon.Min()(1) - EPSILON>vOnPlane(1))
       || (boxPolygon.Max()(1) + EPSILON<vOnPlane(1))
       || (boxPolygon.Min()(2) - EPSILON>vOnPlane(2))
       || (boxPolygon.Max()(2) + EPSILON<vOnPlane(2))
       || (boxPolygon.Min()(3) - EPSILON>vOnPlane(3))
       || (boxPolygon.Max()(3) + EPSILON<vOnPlane(3))) {
        continue;
      }

      // find major axes of the polygon plane
      INDEX iMajorAxis1, iMajorAxis2;
      GetMajorAxesForPlane(plPolygon, iMajorAxis1, iMajorAxis2);

      // create an intersector
      CIntersector isIntersector(_vHandle(iMajorAxis1), _vHandle(iMajorAxis2));
      // for all edges in the polygon
      FOREACHINSTATICARRAY(bpo.bpo_abpePolygonEdges, CBrushPolygonEdge, itbpePolygonEdge) {
        // get edge vertices (edge direction is irrelevant here!)
        const FLOAT3D &vVertex0 = itbpePolygonEdge->bpe_pbedEdge->bed_pbvxVertex0->bvx_vAbsolute;
        const FLOAT3D &vVertex1 = itbpePolygonEdge->bpe_pbedEdge->bed_pbvxVertex1->bvx_vAbsolute;
        // pass the edge to the intersector
        isIntersector.AddEdge(
          vVertex0(iMajorAxis1), vVertex0(iMajorAxis2),
          vVertex1(iMajorAxis1), vVertex1(iMajorAxis2));
      }

      // skip if the point is not inside polygon
      if (!isIntersector.IsIntersecting()) {
        continue;
      }

      // remember the polygon
      _pbpoNear = &bpo;
      _fNearDistance = fDistance;
      _vNearPoint = vOnPlane;
    }}

    // for each entity in the sector
    {FOREACHDSTOFSRC(pbsc->bsc_rsEntities, CEntity, en_rdSectors, pen)
      // if it is a brush
      if (pen->en_RenderType == CEntity::RT_BRUSH) {
        // get its brush
        CBrush3D &brBrush = *pen->en_pbrBrush;
        // add all sectors in the brush
        AddAllSectorsOfBrush(&brBrush);
      }
    ENDFOR}
  }
};

CBrushPolygon *GetNearestPolygon_Portal(CEntity *pen, FLOAT3D &vPoint, FLOATplane3D &plPlane, FLOAT &fDistanceToEdge) {
  // take reference point at handle of the model entity
  _vHandle = pen->en_plPlacement.pl_PositionVector;

  // start infinitely far away
  _pbpoNear = NULL;
  _fNearDistance = UpperLimit(1.0f);

  // for each zoning sector that this entity is in
  {FOREACHSRCOFDST(pen->en_rdSectors, CBrushSector, bsc_rsEntities, pbsc)
    // add the sector
    AddSector(pbsc);
  ENDFOR}

  // start the search
  SearchThroughSectors_Portal();

  // mark each sector as inactive
  for (INDEX ias = 0; ias < _aas.Count(); ias++) {
    _aas[ias].as_pbsc->bsc_ulFlags &= ~BSCF_NEARTESTED;
  }
  _aas.PopAll();

  // if there is some polygon found
  if (_pbpoNear != NULL) {
    // return info
    plPlane = _pbpoNear->bpo_pbplPlane->bpl_plAbsolute;
    vPoint = _vNearPoint;
    fDistanceToEdge = _pbpoNear->GetDistanceFromEdges(_vNearPoint);
    return _pbpoNear;
  }
  return NULL;
};

// Start holding an entity with the gravity gun
void GravityGunStart(CEntity *penObject, CEntity *penWeapons) {
  CSyncedEntityPtr *pSync = GetGravityGunSync(penObject);

  // Cannot be held
  if (pSync == NULL) return;

  // Remember object's physics flags
  ULONG ulPhysFlags = penObject->GetPhysicsFlags();

  // Pass physics flags from the current holder
  CPlayerWeapons *penCurrentHolder = (CPlayerWeapons *)pSync->GetSyncedEntity();

  if (penCurrentHolder != NULL) {
    ulPhysFlags = penCurrentHolder->m_ulObjectFlags;
  }

  // Unhold this object from the current holder
  GravityGunObjectDrop(*pSync);

  // Notify the holder that they can hold
  EGravityGunGrab eGrab;
  eGrab.penObject = penObject;
  eGrab.ulFlags = ulPhysFlags;

  ((CPlayerWeapons *)penWeapons)->SendEvent(eGrab);
};

// Stop holding an entity with the gravity gun
void GravityGunStop(CEntity *penObject, ULONG ulFlags, BOOL bRestoreFlags) {
  if (bRestoreFlags) {
    penObject->SetPhysicsFlags(ulFlags);
  }

  ((CMovableEntity *)penObject)->SetDesiredTranslation(FLOAT3D(0, 0, 0));
  ((CMovableEntity *)penObject)->SetDesiredRotation(ANGLE3D(0, 0, 0));
};

// Force whoever is currently holding this entity to stop holding it
void GravityGunObjectDrop(CSyncedEntityPtr &syncGravityGun, BOOL bCloseProngs) {
  CEntity *penWeapons = syncGravityGun.GetSyncedEntity();

  // No one is holding this object
  if (penWeapons == NULL) return;

  // Force them to drop it
  EGravityGunDrop eDrop;
  eDrop.bCloseProngs = bCloseProngs;

  ((CPlayerWeapons *)penWeapons)->SendEvent(eDrop);
};

// Entity is being held by the gravity gun
void GravityGunHolding(CPlayerWeapons *penWeapons, CMovableEntity *pen, const EGravityGunHold &eHold) {
  const BOOL bItem = IsDerivedFromClass(pen, "Item");

  CPlacement3D plPos = CPlacement3D(eHold.vPos, eHold.aRot);
  pen->SetPhysicsFlags(eHold.ulFlags);

  FLOAT3D vDiff = (plPos.pl_PositionVector - pen->GetPlacement().pl_PositionVector);
  const FLOAT fDiff = vDiff.Length();

  // Collect items
  if (bItem && fDiff < 1.0f) {
    EPass ePass;
    ePass.penOther = penWeapons->m_penPlayer;
    pen->SendEvent(ePass);
    pen->ForceFullStop();
  }

  FLOAT3D vMoveSpeed = FLOAT3D(0.0f, 0.0f, 0.0f);

  if (fDiff > 0.0f) {
    // Slower speed
    if (fDiff > 8.0f + eHold.fDistance) {
      vMoveSpeed = vDiff * 0.5f;
    } else {
      vMoveSpeed = vDiff;
    }
  }

  // Move
  pen->SetDesiredTranslation(vMoveSpeed / ONE_TICK);

  // Too far
  if (fDiff > 12.0f + eHold.fDistance) {
    // Close the prongs because it's out of reach
    EGravityGunDrop eDrop;
    eDrop.bCloseProngs = TRUE;
    penWeapons->SendEvent(eDrop);
    return;
  }

  if (!bItem && !IsOfClassID(pen, CRadio_ClassID)) {
    return;
  }

  // Rotate
  CPlacement3D plNewPos = plPos;
  plNewPos.AbsoluteToRelativeSmooth(pen->GetPlacement());

  ANGLE3D aAngle = plNewPos.pl_OrientationAngle;

  // Normalize angles
  aAngle(1) = Clamp(NormalizeAngle(aAngle(1)), -70.0f, 70.0f);
  aAngle(2) = Clamp(NormalizeAngle(aAngle(2)), -70.0f, 70.0f);
  aAngle(3) = Clamp(NormalizeAngle(aAngle(3)), -70.0f, 70.0f);

  // Set rotation speed
  pen->SetDesiredRotation(aAngle / ONE_TICK);
};

// Push the object with the gravity gun
void GravityGunPush(CEntity *penObject, const FLOAT3D &vDir, const FLOAT3D &vHit) {
  ((CMovableEntity *)penObject)->GiveImpulseTranslationAbsolute(vDir);
};

// Check which entities the gravity gun definitely cannot pick up
static BOOL GravityGunCannotPickUp(CEntity *pen) {
  // Don't pick up large enemies, rolling stones, projectiles, or players
  if (IsOfClassID(pen, CWalker_ClassID)       || IsOfClassID(pen, CWerebull_ClassID)
   || IsOfClassID(pen, CScorpman_ClassID)     || IsOfClassID(pen, CBeast_ClassID)
   || IsOfClassID(pen, CCannonStatic_ClassID) || IsOfClassID(pen, CCannonRotating_ClassID)
   || IsOfClassID(pen, CElemental_ClassID)    || IsOfClassID(pen, CAirElemental_ClassID)
   || IsOfClassID(pen, CExotechLarva_ClassID) || IsOfClassID(pen, CSummoner_ClassID)
   || IsOfClassID(pen, CAntlionGuard_ClassID) || IsOfClassID(pen, CMerasmus_ClassID)
   || IsOfClassID(pen, CRollingStone_ClassID) || IsOfClassID(pen, CProjectile_ClassID)
   || IS_PLAYER(pen)) {
    return TRUE;
  }

  // Don't pick up non-model objects (unless they are physical)
  if (pen->GetRenderType() != CEntity::RT_MODEL && pen->GetRenderType() != CEntity::RT_SKAMODEL) {
    return TRUE;
  }

  // Don't pick up objects without a gravity gun sync class
  return (GetGravityGunSync(pen) == NULL);
};

// Check if the gravity gun can interact with the entity
BOOL GravityGunCanInteract(CCecilPlayerEntity *penPlayer, CEntity *pen, BOOL bPickup) {
  // No object
  if (pen == NULL || pen->GetFlags() & ENF_DELETED) return FALSE;

  // Don't interact with static objects
  if (!IsDerivedFromID(pen, CMovableEntity_ClassID)) return FALSE;

  // Can't pick up certain objects
  if (bPickup && GravityGunCannotPickUp(pen)) return FALSE;

  // Always interact with alive objects
  if (pen->GetFlags() & ENF_ALIVE) return TRUE;

  // Always interact with certain moving objects
  if (IsOfClassID(pen, CMovingBrush_ClassID) || IsOfClassID(pen, CRollingStone_ClassID)
   || IsOfClassID(pen, CProjectile_ClassID)
   || IsOfClassID(pen, CRadio_ClassID) || IsOfClassID(pen, CRollerMine_ClassID)) {
    return TRUE;
  }

  // Not an item
  if (!IsDerivedFromClass(pen, "Item")) return FALSE;

  CItem &enItem = (CItem &)*pen;

  // Ignore respawning items
  if (enItem.m_bRespawn) return FALSE;

  // Ignore invisible items
  if (pen->GetRenderType() == CEntity::RT_EDITORMODEL
   || pen->GetRenderType() == CEntity::RT_SKAEDITORMODEL) {
    return FALSE;
  }

  // Check if it's already been picked up by the player
  const INDEX iPlayer = penPlayer->GetMyPlayerIndex();
  const BOOL bPickedAlready = (1 << iPlayer) & enItem.m_ulPickedMask;

  return !bPickedAlready;
};

// Get sync class for holding the object using with the gravity gun
CSyncedEntityPtr *GetGravityGunSync(CEntity *pen) {
  if (IsOfClassID(pen, CRadio_ClassID)) {
    return &((CRadio *)pen)->m_syncGravityGun;

  } else if (IsOfClassID(pen, CRollerMine_ClassID)) {
    return &((CRollerMine *)pen)->m_syncGravityGun;

  } else if (IsDerivedFromID(pen, CEnemyBase_ClassID)) {
    return &((CEnemyBase *)pen)->m_syncGravityGun;

  } else if (IsDerivedFromClass(pen, "Item")) {
    return &((CItem *)pen)->m_syncGravityGun;
  }

  return NULL;
};

// Gravity Gun Held Object chunk
static CChunkID _cidHeldObject("GGHO");

// Serialize sync classes for held objects
void WriteHeldObject(CSyncedEntityPtr &sync, CTStream *ostr) {
  // Only during the game
  if (!IsPlayingGame()) return;
  ostr->WriteID_t(_cidHeldObject);

  CEntity *penSync = sync.GetSyncedEntity();

  if (penSync != NULL) {
    *ostr << (ULONG)penSync->en_ulID;
  } else {
    *ostr << (ULONG)-1;
  }
};

void ReadHeldObject(CSyncedEntityPtr &sync, CTStream *istr, CEntity *pen) {
  // Check if the chunk is written
  if (istr->PeekID_t() != _cidHeldObject) return;
  istr->ExpectID_t(_cidHeldObject);

  ULONG ulID;
  *istr >> ulID;

  if (ulID != -1) {
    CEntity *penSync = pen->GetWorld()->EntityFromID(ulID);
    sync.Sync(GetGravityGunSync(penSync));
  } else {
    sync.Unsync();
  }
};
