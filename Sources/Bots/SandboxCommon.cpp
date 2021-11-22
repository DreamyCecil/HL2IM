/* Copyright (c) 2018-2021 Dreamy Cecil
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

// [Cecil] 2019-06-02: This file is for common elements and functions from the mod
#include "StdH.h"
#include "Bots/BotFunctions.h"

#include "EntitiesMP/Item.h"

// --- Helper functions

// [Cecil] 2019-06-02: Function from Serious Gang mod that returns amount of numbers in the fraction
INDEX FractionNumbers(FLOAT fNumber) {
  INDEX iNumbers = 0;
  FLOAT fShift = 0.000001f; // 6 numbers max

  double dDummy = 0;
  FLOAT fDecimalPoint = Abs(modf(fNumber, &dDummy));

  while (fDecimalPoint > fShift) {
    fDecimalPoint *= 10.0f;
    fDecimalPoint = Abs(modf(fDecimalPoint, &dDummy));
    iNumbers++;
    fShift *= 10.0f;
  }
  return iNumbers;
};

// [Cecil] 2019-06-02: Convert float number into the string without extra zeros
inline CTString FloatToStr(const FLOAT &f) {
  CTString str;
  str.PrintF("%.*f", FractionNumbers(f), f);

  return str;
};

// [Cecil] 2019-06-04: Convert unsigned long into a binary number
CTString ULongToBinary(ULONG ul) {
  if (ul == 0) {
    return "0";
  }

  CTString strOut = "";

  while (ul) {
    strOut.InsertChar(0, (ul & 1) ? '1' : '0');
    ul >>= 1;
  }

  return strOut;
};

// [Cecil] 2019-06-05: Return file name with extension
CTString FileNameWithExt(CTString strFileName) {
  // find last backlash in what's left
  char *pBackSlash = strrchr(strFileName.str_String, '\\');

  // return everything if there is no backslash
  if (pBackSlash == NULL) {
    return strFileName;
  }

  // return the string, starting after the backslash
  return CTString(pBackSlash+1);
};

// [Cecil] 2020-07-29: Project 3D line onto 2D space
BOOL ProjectLine(CProjection3D *ppr, FLOAT3D vPoint1, FLOAT3D vPoint2, FLOAT3D &vOnScreen1, FLOAT3D &vOnScreen2) {
  vOnScreen1 = FLOAT3D(0.0f, 0.0f, 0.0f);
  vOnScreen2 = FLOAT3D(0.0f, 0.0f, 0.0f);

  // Project before clipping
  FLOAT3D vClip1, vClip2;
  ppr->PreClip(vPoint1, vClip1);
  ppr->PreClip(vPoint2, vClip2);

  ULONG ulClipFlags = ppr->ClipLine(vClip1, vClip2);

  // The edge remains after clipping
  if (ulClipFlags != LCF_EDGEREMOVED) {
    // Project points
    ppr->PostClip(vClip1, vOnScreen1);
    ppr->PostClip(vClip2, vOnScreen2);

    return TRUE;
  }

  return FALSE;
};

// [Cecil] 2018-10-28: Finds an entity by its ID
CEntity *FindEntityByID(CWorld *pwo, const INDEX &iEntityID) {
  // invalid ID
  if (iEntityID < 0) {
    return NULL;
  }

  // for each entity
  FOREACHINDYNAMICCONTAINER(pwo->wo_cenEntities, CEntity, iten) {
    CEntity *pen = iten;

    // if it exists
    if (!(pen->GetFlags() & ENF_DELETED)) {
      // if same ID
      if (pen->en_ulID == iEntityID) {
        // return it
        return pen;
      }
    }
  }

  // otherwise, none exists
  return NULL;
};

// [Cecil] 2021-06-14: Check if item is pickable
BOOL IsItemPickable(class CPlayer *pen, class CItem *penItem, const BOOL &bCheckDist) {
  // [Cecil] TEMP: Too far
  if (bCheckDist && DistanceTo(pen, penItem) > GetItemDist((CPlayerBot *)pen, penItem)) {
    return FALSE;
  }

  BOOL bPicked = (pen == NULL ? FALSE : (1 << CECIL_PlayerIndex(pen)) & penItem->m_ulPickedMask);

  return !bPicked && (penItem->en_RenderType == CEntity::RT_MODEL
                   || penItem->en_RenderType == CEntity::RT_SKAMODEL);
};

// [Cecil] 2021-06-16: Determine vertical position difference
FLOAT3D VerticalDiff(FLOAT3D vPosDiff, const FLOAT3D &vGravityDir) {
  // vertical difference based on the gravity vector
  vPosDiff(1) *= vGravityDir(1);
  vPosDiff(2) *= vGravityDir(2);
  vPosDiff(3) *= vGravityDir(3);

  return vPosDiff;
};

// [Cecil] 2021-06-14: Determine position difference on the same plane
FLOAT3D HorizontalDiff(FLOAT3D vPosDiff, const FLOAT3D &vGravityDir) {
  // remove vertical difference
  return vPosDiff + VerticalDiff(vPosDiff, vGravityDir);
};

// [Cecil] 2021-06-28: Get relative angles from the directed placement
FLOAT GetRelH(const CPlacement3D &pl) {
  FLOATmatrix3D mRot;
  MakeRotationMatrixFast(mRot, pl.pl_OrientationAngle);
  
  FLOAT3D vDir = FLOAT3D(pl.pl_PositionVector).SafeNormalize();

  // get front component of vector
  FLOAT fFront = -vDir(1) * mRot(1, 3)
                 -vDir(2) * mRot(2, 3)
                 -vDir(3) * mRot(3, 3);

  // get left component of vector
  FLOAT fLeft = -vDir(1) * mRot(1, 1)
                -vDir(2) * mRot(2, 1)
                -vDir(3) * mRot(3, 1);

  // relative heading is arctan of angle between front and left
  return ATan2(fLeft, fFront);
};

FLOAT GetRelP(const CPlacement3D &pl) {
  FLOATmatrix3D mRot;
  MakeRotationMatrixFast(mRot, pl.pl_OrientationAngle);
  
  FLOAT3D vDir = FLOAT3D(pl.pl_PositionVector).SafeNormalize();

  // get front component of vector
  FLOAT fFront = -vDir(1) * mRot(1, 3)
                 -vDir(2) * mRot(2, 3)
                 -vDir(3) * mRot(3, 3);

  // get up component of vector
  FLOAT fUp = +vDir(1) * mRot(1, 2)
              +vDir(2) * mRot(2, 2)
              +vDir(3) * mRot(3, 2);

  // relative pitch is arctan of angle between front and up
  return ATan2(fUp, fFront);
};

// [Cecil] 2020-07-29: Do the ray casting with specific passable flags
void CastRayFlags(CCastRay &cr, CWorld *pwoWorld, ULONG ulPass) {
  // initially no polygon is found
  cr.cr_pbpoBrushPolygon= NULL;
  cr.cr_pbscBrushSector = NULL;
  cr.cr_penHit = NULL;

  // [Cecil] 2020-07-29: Set own flags
  if (ulPass != 0) {
    cr.cr_ulPassablePolygons = ulPass;

  } else if (cr.cr_bPhysical) {
    cr.cr_ulPassablePolygons = BPOF_PASSABLE | BPOF_SHOOTTHRU;

  } else {
    cr.cr_ulPassablePolygons = BPOF_PORTAL | BPOF_OCCLUDER;
  }

  // if origin entity is given
  if (cr.cr_penOrigin != NULL) {
    // add all sectors around it
    cr.AddSectorsAroundEntity(cr.cr_penOrigin);

    // test all sectors recursively
    cr.TestThroughSectors();

  // if there is no origin entity
  } else {
    // test entire world against ray
    cr.TestWholeWorld(pwoWorld);
  }

	// calculate the hit point from the hit distance
  cr.cr_vHit = cr.cr_vOrigin + (cr.cr_vTarget - cr.cr_vOrigin).Normalize() * cr.cr_fHitDistance;
};

// [Cecil] 2018-10-15: Check if polygon is suitable for walking on
BOOL FlatPolygon(CWorld *wo, CBrushPolygon *pbpo) {
  // check its type
  INDEX iSurface = pbpo->bpo_bppProperties.bpp_ubSurfaceType;
  CSurfaceType &st = wo->wo_astSurfaceTypes[iSurface];

  // compare planes
  FLOAT3D vPlane = -(FLOAT3D&)pbpo->bpo_pbplPlane->bpl_plAbsolute;
  ANGLE3D aCur, aPol;
  // [Cecil] NOTE: Should be a gravity vector here, which is hard to get from a sector, so just point down
  DirectionVectorToAngles(FLOAT3D(0.0f, -1.0f, 0.0f), aCur);
  DirectionVectorToAngles(vPlane, aPol);

  // find the difference
  aPol -= aCur;

  // [Cecil] 2021-06-18: Determine angle difference based on a stairs flag
  FLOAT fAngleDiff = (pbpo->bpo_ulFlags & BPOF_STAIRS) ? 85.0f : 45.0f;

  // it's a suitable polygon if the plane is not slippery and isn't vertical
  return (st.st_fFriction >= 1.0f && aPol(2) <= fAngleDiff && aPol(3) <= fAngleDiff);
};

// [Cecil] Check if entity is of given DLL class
BOOL IsOfDllClass(CEntity *pen, const CDLLEntityClass &dec) {
  if (pen == NULL) {
    return FALSE;
  }

  if (pen->GetClass()->ec_pdecDLLClass == &dec) {
    return TRUE;
  }

  return FALSE;
};

// [Cecil] Check if entity is of given DLL class or derived from it
BOOL IsDerivedFromDllClass(CEntity *pen, const CDLLEntityClass &dec) {
  if (pen == NULL) {
    return FALSE;
  }

  // for all classes in hierarchy of the entity
  for (CDLLEntityClass *pdecDLLClass = pen->GetClass()->ec_pdecDLLClass;
       pdecDLLClass != NULL;
       pdecDLLClass = pdecDLLClass->dec_pdecBase) {
    // the same DLL class
    if (pdecDLLClass == &dec) {
      return TRUE;
    }
  }

  return FALSE;
};

// --- Replacement functions

// [Cecil] 2021-06-12: Looping through players and bots
INDEX CECIL_GetMaxPlayers(void) {
  return CEntity::GetMaxPlayers() + _cenPlayerBots.Count();
};

CPlayer *CECIL_GetPlayerEntity(const INDEX &iPlayer) {
  const INDEX ctReal = CEntity::GetMaxPlayers();

  // prioritize players
  if (iPlayer < ctReal) {
    return (CPlayer *)CEntity::GetPlayerEntity(iPlayer);
  }

  return _cenPlayerBots.Pointer(iPlayer - ctReal);
};

// [Cecil] 2021-06-13: Get personal player index
INDEX CECIL_PlayerIndex(CPlayer *pen) {
  INDEX ctPlayers = CEntity::GetMaxPlayers();

  if (pen->IsBot()) {
    INDEX iBot = _cenPlayerBots.Index((CPlayerBot *)pen);

    // occupy the rest of the bits by bots
    return ctPlayers + (iBot % (32 - ctPlayers));
  }

  return pen->GetMyPlayerIndex();
};
