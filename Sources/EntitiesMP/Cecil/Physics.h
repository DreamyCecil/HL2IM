// [Cecil] Similar to EPF_STICKYFEET but only affects rotation
#define EPF_ROTATETOPLANE (1UL<<17)

// [Cecil] GetNearestPolygon() but with portal polygons
void SearchThroughSectors_Portal(void);
CBrushPolygon *GetNearestPolygon_Portal(CEntity *pen, FLOAT3D &vPoint, FLOATplane3D &plPlane, FLOAT &fDistanceToEdge);

// [Cecil] Start holding an entity with the gravity gun
void GravityGunStart(CMovableEntity *pen, CEntity *penHolder);
// [Cecil] Stop holding an entity with the gravity gun
void GravityGunStop(CMovableEntity *pen, const EGravityGunStop &eStop);
// [Cecil] Entity is being held by the gravity gun
void GravityGunHolding(CMovableEntity *pen, const EGravityGunHold &eHold);
// [Cecil] Push the object with the gravity gun
void GravityGunPush(CMovableEntity *pen, FLOAT3D vDir);

// [Cecil] PreMoving() with rotate-to-plane flag
void Cecil_PreMoving(CMovableEntity *pen, FLOAT3D &vRotationDir);