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

#pragma once

// [Cecil] 2021-06-17: NavMesh generation types
#define NAVMESH_TRIANGLES 0 // on each triangle of a polygon
#define NAVMESH_POLYGONS  1 // on full polygons
#define NAVMESH_EDGES     2 // on each edge of a polygon

// Current NavMesh generation type
#define NAVMESH_GEN_TYPE NAVMESH_EDGES

// Path Point Flags (rearranging them can break previously created NavMeshes)
#define PPF_WALK        (1 << 0) // don't run from this point
#define PPF_JUMP        (1 << 1) // jump from this point
#define PPF_CROUCH      (1 << 2) // crouch while going from this point
#define PPF_OVERRIDE    (1 << 3) // apply point's flags before reaching the point
#define PPF_UNREACHABLE (1 << 4) // cannot be reached directly by foot (only for target points)
#define PPF_TELEPORT    (1 << 5) // acts as a teleport and has 0 distance to any target point

// [Cecil] 2018-10-24: Bot Path Polygons
class DECL_DLL CBotPathPolygon {
  public:
    // Original brush polygon
    CBrushPolygon *bppo_bpoPolygon;

    // Vertex positions of this polygon (should always be three)
    CStaticArray<FLOAT3D> bppo_avVertices;

    // Constructor & Destructor
    CBotPathPolygon(void);
    ~CBotPathPolygon(void);

    // Writing & Reading
    void Write(CTStream *strm);
    void Read(CTStream *strm);

    // Absolute center position of this polygon
    FLOAT3D Center(void);
};

// [Cecil] 2018-10-22: Bot Path Points
class DECL_DLL CBotPathPoint {
  public:
    INDEX bpp_iIndex;  // personal ID of this point in the NavMesh
    FLOAT3D bpp_vPos;  // position of this point
    FLOAT bpp_fRange;  // walking radius of a point
    ULONG bpp_ulFlags; // special point flags
    CEntity *bpp_penImportant; // important entity
    CBotPathPoint *bpp_pbppNext; // next important point
    // [Cecil] TODO: Add defending time which would force bots to stay on important points for some time
    //FLOAT bpp_fDefendTime;

    // Polygon of this point
    CBotPathPolygon *bpp_bppoPolygon;

    // Possible connections
    CDynamicContainer<CBotPathPoint> bpp_cbppPoints;

    // Constructor & Destructor
    CBotPathPoint(void);
    ~CBotPathPoint(void);

    // Writing & Reading
    void Write(CTStream *strm);
    void Read(CTStream *strm);

    // Path points comparison
    inline BOOL operator==(const CBotPathPoint &bppOther);
    inline BOOL operator==(const CBotPathPoint &bppOther) const;

    // Make a connection with a specific point
    void Connect(CBotPathPoint *pbppPoint, INDEX iType);
};

// [Cecil] Path points in open and closed lists (only for path finding)
class CPathPoint {
  public:
    CBotPathPoint *pp_bppPoint;
    CPathPoint *pp_ppFrom;
    FLOAT pp_fG;
    FLOAT pp_fH;
    FLOAT pp_fF;

    CPathPoint() :
      pp_bppPoint(NULL), pp_ppFrom(NULL),
      pp_fG(-1.0f), // infinity
      pp_fH( 0.0f), // nothing
      pp_fF(-1.0f)  // infinity
    {};
};

// [Cecil] 2018-10-23: Bot NavMesh
class DECL_DLL CBotNavmesh {
  public:
    // All path points
    CDynamicContainer<CBotPathPoint> bnm_cbppPoints;
    // All brush polygons in the world
    CStaticArray<CBrushPolygon *> bnm_apbpoPolygons;
    // World for this NavMesh
    CWorld *bnm_pwoWorld; 

    BOOL bnm_bGenerated; // has NavMesh been generated or not
    INDEX bnm_iNextPointID; // index for the next point

    // Find next point in the NavMesh
    CBotPathPoint *FindNextPoint(CBotPathPoint *bppSrc, CBotPathPoint *bppDst);
    CBotPathPoint *ReconstructPath(CPathPoint *ppCurrent);

    // Constructor & Destructor
    CBotNavmesh(void);
    ~CBotNavmesh(void);

    // Writing & Reading
    void Write(CTStream *strm);
    void Read(CTStream *strm);

    // Saving & Loading for a specific world
    void Save(CWorld &wo);
    void Load(CWorld &wo);

    // Clear the NavMesh
    void ClearNavMesh(void);

    // Add a new path point to the navmesh
    CBotPathPoint *AddPoint(const FLOAT3D &vPoint, CBotPathPolygon *bppo);
    // Find a point by its ID
    CBotPathPoint *FindPointByID(const INDEX &iPoint);
    // Find some important point
    CBotPathPoint *FindImportantPoint(CPlayer *penBot, const INDEX &iPoint);

    // Generate the NavMesh
    void GenerateNavmesh(CWorld *pwo);
    // Connect all points together
    void ConnectPoints(const INDEX &iPoint);
};

// [Cecil] 2018-10-23: Bot NavMesh
DECL_DLL extern CBotNavmesh *_pNavmesh;
