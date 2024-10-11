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

// Held object data (used to be an entity event)
struct EGravityGunHold {
  FLOAT3D vPos; // Position to move at
  ANGLE3D aRot; // Rotation
  FLOAT fDistance; // Distance the object is being held at
  ULONG ulFlags; // Physics flags to apply
};

// Start holding an object with the gravity gun
void GravityGunStart(CEntity *penObject, CEntity *penWeapons);

// Stop holding an object with the gravity gun
void GravityGunStop(CEntity *penObject, ULONG ulFlags);

// Force whoever is currently holding this object to stop holding it
void GravityGunObjectDrop(CSyncedEntityPtr &syncGravityGun, BOOL bCloseProngs = TRUE);

// Entity is being held by the gravity gun
void GravityGunHolding(class CPlayerWeapons *penWeapons, CMovableEntity *pen, const EGravityGunHold &eHold);

// Push the object with the gravity gun
void GravityGunPush(CEntity *penObject, const FLOAT3D &vDir, const FLOAT3D &vHit);

// Check if the gravity gun can interact with the entity
BOOL GravityGunCanInteract(CCecilPlayerEntity *penPlayer, CEntity *pen, BOOL bPickup);

// Get sync class for holding the object using with the gravity gun
CSyncedEntityPtr *GetGravityGunSync(CEntity *pen);

// Serialize sync classes for held objects
void WriteHeldObject(CSyncedEntityPtr &sync, CTStream *ostr);
void ReadHeldObject(CSyncedEntityPtr &sync, CTStream *istr, CEntity *pen);
