#include "StdH.h"

#include "Weapons.h"

// New ammo system
// NOTE: Some are multiplied for the balance
extern const INDEX _aiMaxAmmo[11] = {
  150,  // USP
  12*2, // 357
  225,  // SMG1
  60*2, // AR2
  30*2, // SPAS
  10*2, // Crossbow
  5*2,  // Grenades
  3*3,  // RPG
  100,  // G3SG1

  3, // SMG1 Grenades
  3, // AR2 Energy Balls
};

extern const INDEX _aiMaxMag[8] = {
  18, // USP
  6,  // 357
  45, // SMG1
  30, // AR2
  6,  // SPAS
  1,  // Crossbow
  1,  // RPG
  20, // G3SG1
};

// Compatibility
extern const INDEX _aiTakeAmmo[11] = {
  -1, // USP
  (1 << AMMO_NAPALM),        // 357
  (1 << AMMO_SHELLS),        // SMG1
  (1 << AMMO_ELECTRICITY) | (1 << AMMO_ROCKETS), // AR2
  (1 << AMMO_BULLETS),       // SPAS
  (1 << AMMO_SNIPERBULLETS), // Crossbow
  (1 << AMMO_GRENADES),      // Grenades
  (1 << AMMO_IRONBALLS),     // RPG
  -1,                        // G3SG1

  -1, // SMG1 Grenades
  -1, // AR2 Energy Balls
};
// Sorted by weapons
extern const INDEX _aiTakeWeaponAmmo[] = {
  -1,             // Crowbar
  -1,             // USP
  _aiTakeAmmo[1], // 357
  _aiTakeAmmo[4], // SPAS
  -1,             // G3SG1
  _aiTakeAmmo[2], // SMG1
  _aiTakeAmmo[3], // AR2
  _aiTakeAmmo[7], // RPG
  _aiTakeAmmo[6], // Grenade
  -1,             // Gravity Gun
  -1,             // Flamer
  -1,             // Laser
  _aiTakeAmmo[5], // Crossbow
  -1,             // Iron Cannon
};

// Animate a block of attachments
void AttachAnim(CModelObject &mo, const INDEX &i1, const INDEX &i2, const INDEX &i3, const INDEX &iAnim, ULONG ulFlags) {
  if (i1 != -1) {
    mo.GetAttachmentModel(i1)->amo_moModelObject.PlayAnim(iAnim, ulFlags);
  }
  if (i2 != -1) {
    mo.GetAttachmentModel(i2)->amo_moModelObject.PlayAnim(iAnim, ulFlags);
  }
  if (i3 != -1) {
    mo.GetAttachmentModel(i3)->amo_moModelObject.PlayAnim(iAnim, ulFlags);
  }
};

// Get animation speed of an attachment
FLOAT GetAnimSpeed(CModelObject &mo, const INDEX &iAttachment, const INDEX &iAnim) {
  if (iAttachment != -1) {
    return mo.GetAttachmentModel(iAttachment)->amo_moModelObject.GetAnimLength(iAnim);
  }
  
  return 0.0f;
};

// Get current animation of an attachment
INDEX GetCurrentAnim(CModelObject &mo, const INDEX &iAttachment) {
  if (iAttachment != -1) {
    return mo.GetAttachmentModel(iAttachment)->amo_moModelObject.GetAnim();
  }
  
  return 0;
};