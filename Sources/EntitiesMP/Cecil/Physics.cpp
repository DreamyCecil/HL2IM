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
#include <EntitiesMP/Mod/Radio.h>

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

// [Cecil] GetNearestPolygon() but with portal polygons
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

// [Cecil] Start holding an entity with the gravity gun
void GravityGunStart(CMovableEntity *pen, CEntity *penHolder) {
  // unhold this object from other players
  for (INDEX iPlayer = 0; iPlayer < CEntity::GetMaxPlayers(); iPlayer++) {
    CEntity *penPlayer = CEntity::GetPlayerEntity(iPlayer);

    if (penPlayer == NULL || penPlayer->GetFlags() & ENF_DELETED) {
      continue;
    }

    // skip the holder
    if (penPlayer == penHolder) {
      continue;
    }

    CPlayerWeapons *penWeapons = ((CPlayer*)penPlayer)->GetPlayerWeapons();

    // same object
    if (penWeapons->m_penHolding == pen) {
      //penWeapons->StopHolding();

      EGravityGunStop eStop;
      eStop.ulFlags = 0;
      penWeapons->SendEvent(eStop);
    }
  }

  // notify the holder that they can hold
  EGravityGunStart eStart;
  eStart.penTarget = pen;

  CPlayerWeapons *penWeapons = ((CPlayer*)penHolder)->GetPlayerWeapons();
  penWeapons->SendEvent(eStart);
};

// [Cecil] Stop holding an entity with the gravity gun
void GravityGunStop(CMovableEntity *pen, const EGravityGunStop &eStop) {
  ULONG ulFlags = eStop.ulFlags;
  //ULONG ulCollision = eStop.ulCollision;

  pen->SetPhysicsFlags(ulFlags);
  //pen->SetCollisionFlags(ulCollision);

  pen->SetDesiredTranslation(FLOAT3D(0.0f, 0.0f, 0.0f));
  pen->SetDesiredRotation(ANGLE3D(0.0f, 0.0f, 0.0f));
};

// [Cecil] Entity is being held by the gravity gun
void GravityGunHolding(CMovableEntity *pen, const EGravityGunHold &eHold) {
  CPlacement3D plPos = CPlacement3D(eHold.vPos, eHold.aRot);
  ULONG ulFlags = eHold.ulFlags;
  //ULONG ulCollision = eHold.ulCollision;

  const BOOL bItem = IsDerivedFromClass(pen, "Item");

  pen->SetPhysicsFlags(ulFlags);
  //pen->SetCollisionFlags(ulCollision);

  FLOAT3D vDiff = (plPos.pl_PositionVector - pen->GetPlacement().pl_PositionVector);
  const FLOAT fDiff = vDiff.Length();

  // Collect items
  if (bItem && fDiff < 1.0f) {
    EPass ePass;
    ePass.penOther = ((CPlayerWeapons&)*eHold.penHolder).m_penPlayer;
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
  pen->SetDesiredTranslation(vMoveSpeed / _pTimer->TickQuantum);

  // Too far
  if (fDiff > 12.0f + eHold.fDistance) {
    //StopHolding();
    //ProngsAnim(FALSE, FALSE);

    CEntity *penHolder = eHold.penHolder;

    EGravityGunStop eStop;
    eStop.ulFlags = 1;
    penHolder->SendEvent(eStop);
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
  pen->SetDesiredRotation(aAngle / _pTimer->TickQuantum);
};

// [Cecil] Push the object with the gravity gun
void GravityGunPush(CMovableEntity *pen, FLOAT3D vDir) {
  pen->GiveImpulseTranslationAbsolute(vDir);
};
