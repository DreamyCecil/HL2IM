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

#include "StdH.h"
#include "AdvancedPaths.h"

// [Cecil] 2021-06-16: Normally shouldn't be here, only for ImportantForNavMesh() function
#include "BotFunctions.h"

// [Cecil] 2018-10-23: Bot NavMesh
extern CBotNavmesh *_pNavmesh = NULL;

// Absolute center position of this polygon
FLOAT3D CBotPathPolygon::Center(void) {
  #if NAVMESH_GEN_TYPE == NAVMESH_POLYGONS
    FLOAT3D vCenter = FLOAT3D(0.0f, 0.0f, 0.0f);

    for (INDEX i = 0; i < bppo_avVertices.Count(); i++) {
      vCenter += bppo_avVertices[i];
    }

    return vCenter / (FLOAT)Max((INDEX)bppo_avVertices.Count(), (INDEX)1);

  #else
    FLOAT3D vCenter = bppo_avVertices[0] + bppo_avVertices[1] + bppo_avVertices[2];
    return vCenter / 3.0f;
  #endif
};

// Constructor & Destructor
CBotPathPolygon::CBotPathPolygon(void) {
  #if NAVMESH_GEN_TYPE == NAVMESH_POLYGONS
    bppo_avVertices.Clear();

  #else
    bppo_avVertices.New(3);

    bppo_avVertices[0] = FLOAT3D(0.0f, 0.0f, 0.0f);
    bppo_avVertices[1] = FLOAT3D(0.0f, 0.0f, 0.0f);
    bppo_avVertices[2] = FLOAT3D(0.0f, 0.0f, 0.0f);
  #endif
};

CBotPathPolygon::~CBotPathPolygon(void) {
  bppo_avVertices.Clear();
};

// Writing & Reading
void CBotPathPolygon::Write(CTStream *strm) {
  strm->WriteID_t("PPO2"); // Path POlygon v2

  // write vertex count
  *strm << bppo_avVertices.Count();
  
  // write vertices
  for (INDEX iVtx = 0; iVtx < bppo_avVertices.Count(); iVtx++) {
    *strm << bppo_avVertices[iVtx];
  }
};

void CBotPathPolygon::Read(CTStream *strm) {
  if (strm->PeekID_t() == CChunkID("PPO1")) {
    strm->ExpectID_t("PPO1"); // Path POlygon v1
    
    // read three vertices
    bppo_avVertices.New(3);
    *strm >> bppo_avVertices[0] >> bppo_avVertices[1] >> bppo_avVertices[2];

  } else {
    strm->ExpectID_t("PPO2"); // Path POlygon v2
    
    // read vertex count
    INDEX ctVtx;
    *strm >> ctVtx;
    
    // read vertices
    bppo_avVertices.New(ctVtx);

    for (INDEX iVtx = 0; iVtx < ctVtx; iVtx++) {
      *strm >> bppo_avVertices[iVtx];
    }
  }
};

// Constructor & Destructor
CBotPathPoint::CBotPathPoint(void) {
  bpp_iIndex = -1;
  bpp_vPos = FLOAT3D(0.0f, 0.0f, 0.0f);
  bpp_fRange = 1.0f; // normal range for walking points
  bpp_ulFlags = 0;
  bpp_penImportant = NULL;
  bpp_pbppNext = NULL;

  bpp_bppoPolygon = NULL;
};

CBotPathPoint::~CBotPathPoint(void) {
  // clear connections
  bpp_cbppPoints.Clear();

  // destroy the polygon
  if (bpp_bppoPolygon != NULL) {
    delete bpp_bppoPolygon;
    bpp_bppoPolygon = NULL;
  }
};

// Writing & Reading
void CBotPathPoint::Write(CTStream *strm) {
  strm->WriteID_t("NMP4"); // NavMesh Point v4

  *strm << bpp_iIndex;
  *strm << bpp_vPos;
  *strm << bpp_fRange;
  *strm << bpp_ulFlags;

  if (bpp_penImportant != NULL) {
    *strm << INDEX(bpp_penImportant->en_ulID);
  } else {
    *strm << INDEX(-1);
  }

  // write next important point
  if (bpp_pbppNext != NULL) {
    *strm << _pNavmesh->bnm_cbppPoints.Index(bpp_pbppNext);
  } else {
    *strm << INDEX(-1);
  }

  // write possible connections
  *strm << (bpp_cbppPoints.Count());
  
  // write indices
  FOREACHINDYNAMICCONTAINER(bpp_cbppPoints, CBotPathPoint, itbpp) {
    INDEX iPoint = _pNavmesh->bnm_cbppPoints.Index(itbpp);
    *strm << iPoint;
  }

  // write the polygon
  *strm << UBYTE(bpp_bppoPolygon != NULL);

  if (bpp_bppoPolygon != NULL) {
    bpp_bppoPolygon->Write(strm);
  }
};

void CBotPathPoint::Read(CTStream *strm) {
  INDEX iImportantEntity = -1;
  INDEX iNext = -1;

  if (strm->PeekID_t() == CChunkID("NMP1")) {
    strm->ExpectID_t("NMP1"); // NavMesh Point v1

    *strm >> bpp_iIndex;
    *strm >> bpp_vPos;
    *strm >> bpp_ulFlags;

  } else if (strm->PeekID_t() == CChunkID("NMP2")) {
    strm->ExpectID_t("NMP2"); // NavMesh Point v2

    *strm >> bpp_iIndex;
    *strm >> bpp_vPos;
    *strm >> bpp_ulFlags;
    *strm >> iImportantEntity;

  } else if (strm->PeekID_t() == CChunkID("NMP3")) {
    strm->ExpectID_t("NMP3"); // NavMesh Point v3

    *strm >> bpp_iIndex;
    *strm >> bpp_vPos;
    *strm >> bpp_fRange;
    *strm >> bpp_ulFlags;
    *strm >> iImportantEntity;

  } else {
    strm->ExpectID_t("NMP4"); // NavMesh Point v4

    *strm >> bpp_iIndex;
    *strm >> bpp_vPos;
    *strm >> bpp_fRange;
    *strm >> bpp_ulFlags;
    *strm >> iImportantEntity;
    *strm >> iNext;
  }

  // set important entity
  bpp_penImportant = FindEntityByID(&_pNetwork->ga_World, iImportantEntity);
  
  // set next important point
  if (iNext != -1) {
    bpp_pbppNext = &_pNavmesh->bnm_cbppPoints[iNext];
  } else {
    bpp_pbppNext = NULL;
  }

  // read possible connections
  INDEX ctConnections;
  *strm >> ctConnections;

  while (ctConnections > 0) {
    INDEX iPoint;
    *strm >> iPoint;

    CBotPathPoint *pbpp = &_pNavmesh->bnm_cbppPoints[iPoint];
    bpp_cbppPoints.Add(pbpp);

    ctConnections--;
  }

  // read the polygon
  UBYTE bPolygon;
  *strm >> bPolygon;

  if (bPolygon) {
    bpp_bppoPolygon = new CBotPathPolygon;
    bpp_bppoPolygon->Read(strm);
  }
};

// Path points comparison
inline BOOL CBotPathPoint::operator==(const CBotPathPoint &bppOther) {
  return (this->bpp_iIndex == bppOther.bpp_iIndex);
};

inline BOOL CBotPathPoint::operator==(const CBotPathPoint &bppOther) const {
  return (this->bpp_iIndex == bppOther.bpp_iIndex);
};

// Make a connection with a specific point
void CBotPathPoint::Connect(CBotPathPoint *pbppPoint, INDEX iType) {
  // same point
  if (pbppPoint == this) {
    return;
  }

  // connect to the target
  if (iType == 1 || iType == 2) {
    if (!bpp_cbppPoints.IsMember(pbppPoint)) {
      bpp_cbppPoints.Add(pbppPoint);
    }
  }

  // connect target to this one
  if (iType == 2 || iType == 3) {
    if (!pbppPoint->bpp_cbppPoints.IsMember(this)) {
      pbppPoint->bpp_cbppPoints.Add(this);
    }
  }
};

// Constructor & Destructor
CBotNavmesh::CBotNavmesh(void) {
  bnm_pwoWorld = NULL;
  bnm_bGenerated = FALSE;
  bnm_iNextPointID = 0;
};

CBotNavmesh::~CBotNavmesh(void) {
  ClearNavMesh();
};

// Writing & Reading
void CBotNavmesh::Write(CTStream *strm) {
  strm->WriteID_t("BNM1"); // Bot NavMesh v1

  INDEX ctPoints = bnm_cbppPoints.Count();

  *strm << bnm_bGenerated; // write if generated or not
  *strm << bnm_iNextPointID; // next point ID
  *strm << ctPoints; // amount of points

  // write points
  for (INDEX iPoint = 0; iPoint < ctPoints; iPoint++) {
    CBotPathPoint *pbpp = bnm_cbppPoints.Pointer(iPoint);
    pbpp->Write(strm);
  }
};

void CBotNavmesh::Read(CTStream *strm) {
  INDEX ctPoints;

  // Bot NavMesh v1
  if (strm->PeekID_t() == CChunkID("BNM1")) {
    strm->ExpectID_t("BNM1");
    *strm >> bnm_bGenerated; // read if generated or not
    *strm >> bnm_iNextPointID; // next point ID
    *strm >> ctPoints; // amount of points
  }

  // create points
  for (INDEX iNewPoint = 0; iNewPoint < ctPoints; iNewPoint++) {
    CBotPathPoint *bppNew = new CBotPathPoint();
    bnm_cbppPoints.Add(bppNew);
  }

  // read points
  for (INDEX iPoint = 0; iPoint < ctPoints; iPoint++) {
    CBotPathPoint *pbpp = &bnm_cbppPoints[iPoint];
    pbpp->Read(strm);
  }
};

// Saving & Loading
void CBotNavmesh::Save(CWorld &wo) {
  CTFileName fnFile;
  fnFile.PrintF("Cecil\\Navmeshes\\%s.nav", wo.wo_fnmFileName.FileName().str_String);
  
  CTFileStream strm;
  strm.Create_t(fnFile);
            
  _pNavmesh->bnm_pwoWorld = &wo;
  _pNavmesh->Write(&strm);

  CPrintF("Saved NavMesh for the current map into '%s'\n", fnFile.str_String);
  strm.Close();
};

void CBotNavmesh::Load(CWorld &wo) {
  CTFileName fnFile;
  fnFile.PrintF("Cecil\\Navmeshes\\%s.nav", wo.wo_fnmFileName.FileName().str_String);
  
  CTFileStream strm;
  strm.Open_t(fnFile);

  _pNavmesh->ClearNavMesh();

  _pNavmesh->bnm_pwoWorld = &wo;
  _pNavmesh->Read(&strm);

  CPrintF("Loaded NavMesh for the current map from '%s'\n", fnFile.str_String);
  strm.Close();
};

void CBotNavmesh::ClearNavMesh(void) {
  // [Cecil] 2021-06-22: Untarget all bots
  for (INDEX iBot = 0; iBot < _cenPlayerBots.Count(); iBot++) {
    CPlayerBot *penBot = _cenPlayerBots.Pointer(iBot);

    penBot->m_pbppCurrent = NULL;
    penBot->m_pbppTarget = NULL;
  }

  // destroy all path points
  for (INDEX iDeletePoint = 0; iDeletePoint < bnm_cbppPoints.Count(); iDeletePoint++) {
    CBotPathPoint *pbpp = bnm_cbppPoints.Pointer(iDeletePoint);
    delete pbpp;
  }

  bnm_cbppPoints.Clear();

  // clear pointers to polygons
  bnm_apbpoPolygons.Clear();

  // ready for the next generation
  bnm_bGenerated = FALSE;
  bnm_iNextPointID = 0;
};

// Add a new path point to the navmesh
CBotPathPoint *CBotNavmesh::AddPoint(const FLOAT3D &vPoint, CBotPathPolygon *bppo) {
  CBotPathPoint *bppNew = new CBotPathPoint;
  bppNew->bpp_iIndex = bnm_iNextPointID++;
  bppNew->bpp_vPos = vPoint;
  bppNew->bpp_bppoPolygon = bppo;
  bnm_cbppPoints.Add(bppNew);

  return bppNew;
};

// Find a point by its ID
CBotPathPoint *CBotNavmesh::FindPointByID(const INDEX &iPoint) {
  // ID can't be negative
  if (iPoint < 0) {
    return NULL;
  }

  FOREACHINDYNAMICCONTAINER(bnm_cbppPoints, CBotPathPoint, itbpp) {
    CBotPathPoint *pbpp = itbpp;

    if (pbpp->bpp_iIndex == iPoint) {
      return pbpp;
    }
  }

  return NULL;
};

// Find some important point
CBotPathPoint *CBotNavmesh::FindImportantPoint(CPlayer *penBot, const INDEX &iPoint) {
  if (bnm_pwoWorld == NULL) {
    CPrintF("NavMesh::FindImportantPoint : Cannot find the world!\n");
    return NULL;
  }

  // create array of points
  CDynamicContainer<CBotPathPoint> cbpp;
  INDEX iImportantPoint = 0;

  // [Cecil] 2020-07-28: Reference entity
  CEntity *penReference = NULL;

  FOREACHINDYNAMICCONTAINER(bnm_cbppPoints, CBotPathPoint, itbpp) {
    CBotPathPoint *pbpp = itbpp;

    // not important
    if (pbpp->bpp_penImportant == NULL) {
      continue;
    }

    CEntity *penEntity = pbpp->bpp_penImportant;
    
    // not important at the moment
    if (penEntity == NULL || !ImportantForNavMesh(penBot, penEntity)) {
      continue;
    }

    penReference = penEntity;
    cbpp.Add(pbpp);
    iImportantPoint++;
  }

  if (iImportantPoint > 0) {
    CBotPathPoint *pbppReturn = NULL;
    INDEX iIndex = penReference->IRnd() % iImportantPoint;

    // pick specific point
    if (iPoint >= 0) {
      iIndex = Clamp(iPoint, (INDEX)0, INDEX(iImportantPoint - 1));
      pbppReturn = cbpp.Pointer(iIndex);
      cbpp.Clear();

      return pbppReturn;
    }

    // pick random point
    pbppReturn = cbpp.Pointer(iIndex);
    cbpp.Clear();

    return pbppReturn;
  }

  return NULL;
};

void CBotNavmesh::GenerateNavmesh(CWorld *pwo) {
  if (bnm_bGenerated) {
    CPrintF("Already generated!\n");
    return;
  }

  bnm_pwoWorld = pwo;
  bnm_apbpoPolygons.New(pwo->wo_baBrushes.ba_apbpo.Count());

  INDEX iPoly = 0;

  // go through all brush polygons
  FOREACHINSTATICARRAY(pwo->wo_baBrushes.ba_apbpo, CBrushPolygon *, itbpo) {
    CBrushPolygon *pbpo = itbpo.Current();
    
    // add every polygon to the NavMesh
    bnm_apbpoPolygons[iPoly] = pwo->wo_baBrushes.ba_apbpo[iPoly];
    iPoly++;

    // skip passable polygons
    if (pbpo->bpo_ulFlags & BPOF_PASSABLE) {
      continue;
    }

    // not a flat polygon
    if (!FlatPolygon(pwo, pbpo)) {
      continue;
    }

    // [Cecil] TEMP 2021-06-16: Polygon is too small
    if (pbpo->CalculateArea() < 4.0) {
      continue;
    }

    #if NAVMESH_GEN_TYPE != NAVMESH_TRIANGLES
      INDEX ctVtx = pbpo->bpo_aiTriangleElements.Count();

      // create path polygon
      CBotPathPolygon *bppoNew = new CBotPathPolygon;
      #if NAVMESH_GEN_TYPE == NAVMESH_POLYGONS
        bppoNew->bppo_avVertices.New(ctVtx);
      #endif
      bppoNew->bppo_bpoPolygon = pbpo;

      // center position
      FLOAT3D vPoint = FLOAT3D(0.0f, 0.0f, 0.0f);

      for (INDEX iVtx = 0; iVtx < ctVtx; iVtx++) {
        // get polygon vertex
        INDEX iElement = pbpo->bpo_aiTriangleElements[iVtx];
        CBrushVertex *pbvx = pbpo->bpo_apbvxTriangleVertices[iElement];

        // add new vertex position
        #if NAVMESH_GEN_TYPE == NAVMESH_POLYGONS
          bppoNew->bppo_avVertices[iVtx] = pbvx->bvx_vAbsolute;
        #endif

        vPoint += pbvx->bvx_vAbsolute;
      }

      // average position
      vPoint /= ctVtx;

      // shift it up a little bit
      vPoint(2) += 0.5f;
      
      // check if there's a similar point already
      CBotPathPoint *pbppCheck = NULL;
      
      #if NAVMESH_GEN_TYPE == NAVMESH_POLYGONS
        FOREACHINDYNAMICCONTAINER(bnm_cbppPoints, CBotPathPoint, itbpp) {
          pbppCheck = itbpp;

          FLOAT fDiff = (pbppCheck->bpp_vPos - vPoint).Length();

          if (fDiff <= 1.0f) {
            break;
          }

          pbppCheck = NULL;
        }
      #endif

      if (pbppCheck == NULL) {
        // create a new point
        AddPoint(vPoint, bppoNew);

      } else {
        // move vertices from this polygon to the similar one
        #if NAVMESH_GEN_TYPE == NAVMESH_POLYGONS
          if (pbppCheck->bpp_bppoPolygon != NULL) {
            CStaticArray<FLOAT3D> &avVertices = pbppCheck->bpp_bppoPolygon->bppo_avVertices;

            INDEX ctSimilar = avVertices.Count();
            avVertices.Expand(ctSimilar + ctVtx);

            for (INDEX iMoveVtx = 0; iMoveVtx < ctVtx; iMoveVtx++) {
              avVertices[ctSimilar + iMoveVtx] = bppoNew->bppo_avVertices[iMoveVtx];
            }
          }
        #endif

        // delete polygon
        delete bppoNew;
      }
    
    #else
      INDEX ctTris = pbpo->bpo_aiTriangleElements.Count() / 3;

      for (INDEX iTri = 0; iTri < ctTris; iTri++) {
        for (INDEX iEnd = 0; iEnd < 3; iEnd++) {
          // get transformed end vertices
          INDEX iElem0 = pbpo->bpo_aiTriangleElements[iTri * 3 + (iEnd + 0)];
          INDEX iElem1 = pbpo->bpo_aiTriangleElements[iTri * 3 + (iEnd + 1) % 3];
          INDEX iElem2 = pbpo->bpo_aiTriangleElements[iTri * 3 + (iEnd + 2) % 3];

          CBrushVertex *pbvx0 = pbpo->bpo_apbvxTriangleVertices[iElem0];
          CBrushVertex *pbvx1 = pbpo->bpo_apbvxTriangleVertices[iElem1];
          CBrushVertex *pbvx2 = pbpo->bpo_apbvxTriangleVertices[iElem2];

          // create path polygon
          CBotPathPolygon *bppoNew = new CBotPathPolygon;
          bppoNew->bppo_avVertices[0] = pbvx0->bvx_vAbsolute;
          bppoNew->bppo_avVertices[1] = pbvx1->bvx_vAbsolute;
          bppoNew->bppo_avVertices[2] = pbvx2->bvx_vAbsolute;
          bppoNew->bppo_bpoPolygon = pbpo;
          
          // find center position
          FLOAT3D vPoint = ((pbvx0->bvx_vAbsolute)
                          + (pbvx1->bvx_vAbsolute)
                          + (pbvx2->bvx_vAbsolute)) / 3.0f;
          // shift it up a little bit
          vPoint(2) += 0.5f;

          // check if there's a similar point already
          BOOL bSkip = FALSE;

          FOREACHINDYNAMICCONTAINER(bnm_cbppPoints, CBotPathPoint, itbpp) {
            CBotPathPoint *pbppCheck = itbpp;

            FLOAT fDiff = (pbppCheck->bpp_vPos - vPoint).Length();

            if (fDiff <= 1.0f) {
              bSkip = TRUE;
              break;
            }
          }

          if (!bSkip) {
            // create a new point
            AddPoint(vPoint, bppoNew);

          } else {
            // delete polygon
            delete bppoNew;
          }
        }
      }
    #endif
  }

  CPrintF("%d polygons, generated %d points\n", bnm_apbpoPolygons.Count(), bnm_cbppPoints.Count());
};

void CBotNavmesh::ConnectPoints(const INDEX &iPoint) {
  if (iPoint < 0 || iPoint >= bnm_cbppPoints.Count()) {
    return;
  }

  CBotPathPoint *bppCurrent = &bnm_cbppPoints[iPoint];

  // no polygon
  if (bppCurrent->bpp_bppoPolygon == NULL) {
    return;
  }

  // brush polygon of this point
  #if NAVMESH_GEN_TYPE == NAVMESH_EDGES
    CBrushPolygon *pbpoCurrent = bppCurrent->bpp_bppoPolygon->bppo_bpoPolygon;
  #endif

  INDEX ctConnections = 0;

  // for each point, go through all points again
  INDEX ctPoints = bnm_cbppPoints.Count();

  for (INDEX iPointIter = 0; iPointIter < ctPoints; iPointIter++) {
    CBotPathPoint *bppTarget = bnm_cbppPoints.Pointer(iPointIter);

    // skip itself, with no polygon, existing targets, high points
    if (bppCurrent == bppTarget || bppTarget->bpp_bppoPolygon == NULL
     || bppCurrent->bpp_cbppPoints.IsMember(bppTarget)
     /*|| bppTarget->bpp_vPos(2) - bppCurrent->bpp_vPos(2) > 3.5f*/) {
      continue;
    }

    BOOL bConnect = FALSE;
    CBotPathPoint *bppMiddle = NULL;

    // try to connect close vertices
    INDEX iVertices = 0;
    FLOAT3D vVertexPos[2];

    #if NAVMESH_GEN_TYPE == NAVMESH_EDGES
      // brush polygon of the target point
      CBrushPolygon *pbpoTarget = bppTarget->bpp_bppoPolygon->bppo_bpoPolygon;

      INDEX ctTris = pbpoCurrent->bpo_aiTriangleElements.Count() / 3;
      
      for (INDEX iTri = 0; iTri < ctTris; iTri++) {
        for (INDEX iEnd = 0; iEnd < 3; iEnd++) {
          // get transformed end vertex
          INDEX iElement = pbpoCurrent->bpo_aiTriangleElements[iTri * 3 + iEnd];

          // get vertex position
          FLOAT3D vVtx = pbpoCurrent->bpo_apbvxTriangleVertices[iElement]->bvx_vAbsolute;

          // distance from the vertex to one of the edges on the target polygon
          FLOAT fDist = pbpoTarget->GetDistanceFromEdges(vVtx);

          // if close enough
          if (fDist <= 0.5f) {
            // remember vertex position
            if (iVertices < 2) {
              vVertexPos[iVertices] = vVtx;
            }

            // count it
            iVertices++;
          }

          // create middle point that connects these two points
          if (iVertices >= 2) {
            FLOAT3D vMiddlePoint = (vVertexPos[0] + vVertexPos[1]) / 2.0f;
            vMiddlePoint(2) += 0.5f;

            bppMiddle = AddPoint(vMiddlePoint, NULL);

            bConnect = TRUE;
            break;
          }
        }
      }

    #else
      #if NAVMESH_GEN_TYPE == NAVMESH_POLYGONS
        #define CT_POLYGON_VTX(_Point) _Point->bpp_bppoPolygon->bppo_avVertices.Count()
      #else
        #define CT_POLYGON_VTX(_Point) 3
      #endif

      for (INDEX iVtx1 = 0; iVtx1 < CT_POLYGON_VTX(bppCurrent); iVtx1++) {
        for (INDEX iVtx2 = 0; iVtx2 < CT_POLYGON_VTX(bppTarget); iVtx2++) {
          FLOAT3D vDist = (bppCurrent->bpp_bppoPolygon->bppo_avVertices[iVtx1] - bppTarget->bpp_bppoPolygon->bppo_avVertices[iVtx2]);

          // if close enough
          if (vDist.Length() <= 0.5f) {
            // remember vertex position
            if (iVertices < 2) {
              vVertexPos[iVertices] = bppCurrent->bpp_bppoPolygon->bppo_avVertices[iVtx1];
            }

            // count it
            iVertices++;
          }

          // create middle point that connects these two points
          if (iVertices >= 2) {
            FLOAT3D vMiddlePoint = (vVertexPos[0] + vVertexPos[1]) / 2.0f;
            vMiddlePoint(2) += 0.5f;
            //bppMiddle = AddPoint(vMiddlePoint, NULL);

            bConnect = TRUE;
            break;
          }
        }
      }
    #endif

    // connect the points
    if (bConnect) {
      if (bppMiddle == NULL) {
        bppCurrent->Connect(bppTarget, 2);

      } else {
        bppCurrent->Connect(bppMiddle, 2);
        bppMiddle->Connect(bppTarget, 2);
      }

      ctConnections++;
    }
  }

  // delete targetless point
  if (ctConnections <= 0) {
    bnm_cbppPoints.Remove(bppCurrent);
    delete bppCurrent;

    CPrintF("Point %d/%d: No connections\n", iPoint+1, bnm_cbppPoints.Count());

  } else {
    CPrintF("Point %d/%d: Connected to %d points\n", iPoint+1, bnm_cbppPoints.Count(), ctConnections);
  }
};

// [Cecil] Local path points list
static CDynamicContainer<CPathPoint> _cppPoints;
// [Cecil] Open and closed lists of nodes
static CDynamicContainer<CPathPoint> _cppOpen;
static CDynamicContainer<CPathPoint> _cppClosed;
// [Cecil] Final path
static CDynamicContainer<CBotPathPoint> _cbppPath;

// Heuristic cost
static FLOAT PointsDist(CBotPathPoint *pbppSrc, CBotPathPoint *pbppDst) {
  return (pbppSrc->bpp_vPos - pbppDst->bpp_vPos).Length();
};

CBotPathPoint *CBotNavmesh::ReconstructPath(CPathPoint *ppCurrent) {
  while (ppCurrent != NULL) {
    _cbppPath.Add(ppCurrent->pp_bppPoint);
    ppCurrent = ppCurrent->pp_ppFrom;
  }

  // delete created points
  for (INDEX iDeletePoint = 0; iDeletePoint < _cppPoints.Count(); iDeletePoint++) {
    CPathPoint *pp = _cppPoints.Pointer(iDeletePoint);
    delete pp;
  }
  
  // take next point from the end
  INDEX ctPoints = _cbppPath.Count();
  return (ctPoints > 1) ? _cbppPath.Pointer(ctPoints - 2) : NULL;
};

CBotPathPoint *CBotNavmesh::FindNextPoint(CBotPathPoint *pbppSrc, CBotPathPoint *pbppDst) {
  // no points at all
  if (pbppSrc == NULL || pbppDst == NULL) {
    return NULL;
  }

  // reset lists
  _cppPoints.Clear();
  _cppOpen.Clear();
  _cppClosed.Clear();
  _cbppPath.Clear();

  // source point
  CPathPoint *ppSrc = NULL;

  // recreate every point
  FOREACHINDYNAMICCONTAINER(_pNavmesh->bnm_cbppPoints, CBotPathPoint, itbpp) {
    CBotPathPoint *pbpp = itbpp;
    CPathPoint *ppPoint = new CPathPoint;

    ppPoint->pp_bppPoint = pbpp;

    _cppPoints.Add(ppPoint);

    // remember the source
    if (pbpp == pbppSrc) {
      ppSrc = ppPoint;
    }
  }

  ppSrc->pp_fG = 0.0f;
  ppSrc->pp_fH = PointsDist(pbppSrc, pbppDst);
  ppSrc->pp_fF = ppSrc->pp_fG + ppSrc->pp_fH;

  _cppOpen.Add(ppSrc);

  while (_cppOpen.Count() > 0) {
    CPathPoint *ppShortest = _cppOpen.Pointer(0);

    // find point with shortest path
    if (_cppOpen.Count() > 1) {
      FOREACHINDYNAMICCONTAINER(_cppOpen, CPathPoint, itpp) {
        CPathPoint *pp = itpp;

        if (pp->pp_fF < ppShortest->pp_fF) {
          ppShortest = pp;
        }
      }
    }

    // found destination point
    if (ppShortest->pp_bppPoint == pbppDst) {
      CPathPoint *ppDst = NULL;

      {FOREACHINDYNAMICCONTAINER(_cppPoints, CPathPoint, itpp) {
        CPathPoint *pp = itpp;

        if (pp->pp_bppPoint == pbppDst) {
          ppDst = pp;
          break;
        }
      }}

      return ReconstructPath(ppDst);
    }

    // move this point
    _cppOpen.Remove(ppShortest);
    _cppClosed.Add(ppShortest);

    CBotPathPoint *pbppShortest = ppShortest->pp_bppPoint;

    // check each connection
    FOREACHINDYNAMICCONTAINER(pbppShortest->bpp_cbppPoints, CBotPathPoint, itbpp) {
      CBotPathPoint *pbpp = itbpp;
      CPathPoint *ppNode = NULL;

      {FOREACHINDYNAMICCONTAINER(_cppPoints, CPathPoint, itpp) {
        CPathPoint *pp = itpp;

        if (pp->pp_bppPoint == pbpp) {
          ppNode = pp;
          break;
        }
      }}

      // skip points from the closed list
      if (ppNode == NULL || _cppClosed.IsMember(ppNode)) {
        continue;
      }

      // distance to current target point (none)
      FLOAT fToTarget = 0.0f;

      // if not a teleport point, calculate natural distance
      if (!(pbppShortest->bpp_ulFlags & PPF_TELEPORT)) {
        fToTarget = PointsDist(pbppShortest, pbpp);
      }

      FLOAT fTestG = ppShortest->pp_fG + fToTarget;
      BOOL bSuitable = FALSE;

      if (!_cppOpen.IsMember(ppNode)) {
        _cppOpen.Add(ppNode);
        bSuitable = TRUE;

      } else {
        bSuitable = (fTestG < ppNode->pp_fG);
      }

      if (bSuitable) {
        ppNode->pp_ppFrom = ppShortest;
        ppNode->pp_fG = fTestG;
        ppNode->pp_fH = PointsDist(ppNode->pp_bppPoint, pbppDst);
        ppNode->pp_fF = ppNode->pp_fG + ppNode->pp_fH;
      }
    }
  }

  // delete created points
  for (INDEX iDeletePoint = 0; iDeletePoint < _cppPoints.Count(); iDeletePoint++) {
    CPathPoint *pp = _cppPoints.Pointer(iDeletePoint);
    delete pp;
  }

  return NULL;
};
