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

#define HL2_GOO_SPRAY SPT_GOO //SPT_SLIME

// Surface sound for the player
CTFileName SurfaceStepSound(CPlayer *pen);

// Surface hit sound
CTFileName SurfaceHitSound(CEntity *pen, INDEX iSurface);

// Surface physics impact sound
CTFileName SurfacePhysSound(CEntity *pen, INDEX iSurface, BOOL bHard);

// Particles sound
CTFileName SprayParticlesSound(CEntity *pen, SprayParticlesType spt);

// Get placement of an attachment
CPlacement3D GetAttachmentPlacement(CModelObject *pmo, CAttachmentModelObject &amo);
