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

#define MAG_USP      0
#define MAG_357      1
#define MAG_SMG1     2
#define MAG_AR2      3
#define MAG_SPAS     4
#define MAG_CROSSBOW 5
#define MAG_RPG      6
#define MAG_G3SG1    7

void AttachAnim(CModelObject &mo, const INDEX &i1, const INDEX &i2, const INDEX &i3, const INDEX &iAnim, ULONG ulFlags);
FLOAT GetAnimSpeed(CModelObject &mo, const INDEX &iAttachment, const INDEX &iAnim);
INDEX GetCurrentAnim(CModelObject &mo, const INDEX &iAttachment);

inline INDEX WeaponFlag(const INDEX &iWeapon) {
  return (1 << (iWeapon-1));
};
inline BOOL WeaponExists(const INDEX &iFlags, const INDEX &iWeapon) {
  return (iFlags & WeaponFlag(iWeapon));
};
