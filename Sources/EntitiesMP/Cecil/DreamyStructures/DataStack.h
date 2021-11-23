/* Copyright (c) 2020 Dreamy Cecil
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

#pragma once

#include "DataList.h"

// Data stack
DS_TEMP class CCecilStack : public CCecilList<cType> {
public:
  // Add new element to the end of the stack
  inline int Push(cType pObject);
  
  // Get the top element from the stack
  inline cType &Top(void);
  
  // Remove one element from the end of the stack
  inline cType Pop(void);
  // Remove elements from the end of the stack until a certain element
  int PopUntil(cType pUntil);
};

#include "DataStack.inl"
