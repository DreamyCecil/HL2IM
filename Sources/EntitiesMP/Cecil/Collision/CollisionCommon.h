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
