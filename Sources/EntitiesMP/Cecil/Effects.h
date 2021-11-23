// ***** [Cecil] This header is for Effect functions only! ***** //
#define GIZMO_SPRAY SPT_GOO //SPT_SLIME

// Surface Sound for the Player
CTFileName SurfaceStepSound(CPlayer *pen);
// Surface Impact Sound
CTFileName SurfaceImpactSound(CEntity *pen, const INDEX &iSurface);
// Particles Sound
CTFileName SprayParticlesSound(CEntity *pen, const SprayParticlesType &spt);

// Get placement of an attachment
CPlacement3D GetAttachmentPlacement(CModelObject *pmo, CAttachmentModelObject &amo);
