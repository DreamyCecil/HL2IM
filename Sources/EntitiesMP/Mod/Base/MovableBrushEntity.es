/* Copyright (c) 2002-2012 Croteam Ltd. 
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

3
%{
#include "StdH.h"
%}

uses "EntitiesMP/Mod/Base/MovableEntity";

class export CCecilMovableBrushEntity : CCecilMovableEntity {
name      "MovableBrushEntity";
thumbnail "";

properties:

components:

functions:
  void DoMoving(void) {
    CCecilMovableEntity::DoMoving();
  };

  void Read_t(CTStream *istr) {
    // [Cecil] Better serialize stuff through the same methods
    reinterpret_cast<CMovableBrushEntity *>(this)->CMovableBrushEntity::Read_t(istr);
  };

  void Write_t(CTStream *ostr) {
    // [Cecil] Better serialize stuff through the same methods
    reinterpret_cast<CMovableBrushEntity *>(this)->CMovableBrushEntity::Write_t(ostr);
  };

procedures:
  Dummy() {};
};
