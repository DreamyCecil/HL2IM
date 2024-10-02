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

#include <EntitiesMP/Cecil/Collision/CollisionCommon.h>

// GetNearestPolygon() but with portal polygons
void SearchThroughSectors_Portal(void);
CBrushPolygon *GetNearestPolygon_Portal(CEntity *pen, FLOAT3D &vPoint, FLOATplane3D &plPlane, FLOAT &fDistanceToEdge);

// Start holding an entity with the gravity gun
void GravityGunStart(CMovableEntity *pen, CEntity *penHolder);
// Stop holding an entity with the gravity gun
void GravityGunStop(CMovableEntity *pen, const EGravityGunStop &eStop);
// Entity is being held by the gravity gun
void GravityGunHolding(CMovableEntity *pen, const EGravityGunHold &eHold);
// Push the object with the gravity gun
void GravityGunPush(CMovableEntity *pen, FLOAT3D vDir);

// PreMoving() with rotate-to-plane flag
void Cecil_PreMoving(CMovableEntity *pen, FLOAT3D &vRotationDir);
