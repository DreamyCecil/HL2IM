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

#ifndef CECIL_INCL_COLLISIONCOMMON_H
#define CECIL_INCL_COLLISIONCOMMON_H

#ifdef PRAGMA_ONCE
  #pragma once
#endif

// Pseudo-polygon structure
struct SCollisionPolygon {
  enum EPolygonType {
    POL_INVALID = -1,

    // Real brush polygon with as many edges as possible
    // pbpoHit defines the polygon
    POL_BRUSH,

    // Fake triangle polygon
    // avPolygon defines polygon vertices
    POL_TRIANGLE,

    // Disc polygon with an infinite amount of edges
    // avPolygon[0] - center, avPolygon[1] - radius (any axis), avPolygon[2] - normal
    POL_DISC,

    // Infinitely thin polygon (edge/line or corner/vertex)
    // avPolygon[0] - line start, avPolygon[1] - line end
    POL_EDGE,
  };

  // Polygon identity
  EPolygonType eType;
  CBrushPolygon *pbpoHit; // Real brush polygon (NULL if fake; use avPolygon)
  FLOAT3D avPolygon[3]; // Fake polygon vertices

  // Collision information
  BOOL bHit; // Whether some polygon has been hit at all
  FLOAT3D vCollision; // Point where the collision occurred
  FLOATplane3D plPolygon; // Real - pbpoHit->bpo_pbplPlane->bpl_plAbsolute; Fake - cm_plClippedPlane
  UBYTE ubSurface; // Polygon material
  BOOL bStairs; // Whether it's a stair polygon

  // Constructor
  SCollisionPolygon() {
    Reset();
  };

  // Reset collision polygon to non-hit state
  inline void Reset(void) {
    eType = POL_INVALID;
    pbpoHit = NULL;
    avPolygon[0] = FLOAT3D(0, 0, 0);
    avPolygon[1] = FLOAT3D(0, 0, 0);
    avPolygon[2] = FLOAT3D(0, 0, 0);

    bHit = FALSE;
    vCollision = FLOAT3D(0, 0, 0);
    plPolygon = FLOATplane3D(FLOAT3D(0, 1, 0), 0.0f);
    ubSurface = 0;
    bStairs = FALSE;
  };

  // Set brush polygon
  void SetBrushPolygon(CBrushPolygon *pbpoSet);

  // Set fake polygon
  void SetFakePolygon(const FLOAT3D &v0, const FLOAT3D &v1, const FLOAT3D &v2);

  // Set disc polygon
  void SetDiscPolygon(const FLOAT3D &vCenter, FLOAT fRadius, const FLOAT3D &vNormal);

  // Set infinitely thin polygon
  void SetEdgePolygon(const FLOAT3D &vStart, const FLOAT3D &vEnd);

  // Hit polygon at some collision point
  void HitPolygon(const FLOAT3D &vCollisionPoint);

  // Hit polygon at some collision point with extra setup
  void HitPolygon(const FLOAT3D &vCollisionPoint, const FLOATplane3D &plSetPlane, UBYTE ubSetSurface, BOOL bSetStairs);

  // Check if a point intersects the polygon
  BOOL IsIntersecting(const FLOAT3D &vPoint) const;

  // Assignment operator
  SCollisionPolygon &operator=(const SCollisionPolygon &cpoOther);

  // Serialization
  void Write_t(CEntity *pen, CTStream *ostr);
  void Read_t(CEntity *pen, CTStream *istr);
};

// Determine vertical position difference
inline FLOAT3D VerticalDiff(FLOAT3D vPosDiff, const FLOAT3D &vGravityDir) {
  // Vertical difference based on the gravity vector
  vPosDiff(1) *= vGravityDir(1);
  vPosDiff(2) *= vGravityDir(2);
  vPosDiff(3) *= vGravityDir(3);

  return vPosDiff;
};

// Determine position difference on the same plane
inline FLOAT3D HorizontalDiff(FLOAT3D vPosDiff, const FLOAT3D &vGravityDir) {
  // Remove vertical difference
  return vPosDiff + VerticalDiff(vPosDiff, vGravityDir);
};

// Retrieve custom collision dimensions and shape of some entity
BOOL GetCustomCollisionShape(CEntity *pen, FLOATaabbox3D &boxSize, enum ECollisionShape &eShape);

// Three positions of a collision triangle (counter-clockwise)
struct CollisionTrianglePositions_t {
  FLOAT3D v[3];

  __forceinline CollisionTrianglePositions_t() {};

  __forceinline CollisionTrianglePositions_t(const FLOAT3D &v0, const FLOAT3D &v1, const FLOAT3D &v2) {
    v[0] = v0;
    v[1] = v1;
    v[2] = v2;
  };

  __forceinline FLOAT3D &operator[](int i) { return v[i]; };
  __forceinline const FLOAT3D &operator[](int i) const { return v[i]; };

  __forceinline CollisionTrianglePositions_t &operator=(const CollisionTrianglePositions_t &other) {
    v[0] = other[0];
    v[1] = other[1];
    v[2] = other[2];
    return *this;
  };
};

// List of individual collision triangles
typedef CStaticStackArray<CollisionTrianglePositions_t> CollisionTris_t;

// Get a list of triangles from a bounding box (12 tris = 2 per 6 cube sides)
void GetTrisFromBox(FLOATaabbox3D box, CollisionTris_t &aTris);

// New physics flags
#define EPF_ROTATETOPLANE          (1UL << 17) // Similar to EPF_STICKYFEET but it only affects rotation towards the plane
#define EPF_COLLIDEWITHCUSTOM      (1UL << 18) // Collide with a custom collision surrounding all model vertices, discarding its original collision
#define EPF_CUSTOMCOLLISION        (1UL << 19) // For marking objects with custom collision shapes
#define EPF_COLLIDEWITHCUSTOM_EXCL (1UL << 20) // If EPF_COLLIDEWITHCUSTOM is set, only collides with custom shapes if objects are marked with EPF_CUSTOMCOLLISION

#endif
