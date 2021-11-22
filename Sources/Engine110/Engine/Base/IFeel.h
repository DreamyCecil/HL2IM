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

#ifndef SE_INCL_IFEEL_H
#define SE_INCL_IFEEL_H
#ifdef PRAGMA_ONCE
  #pragma once
#endif

ENGINE_API BOOL IFeel_InitDevice(HINSTANCE &hInstance, HWND &hWnd);
ENGINE_API void IFeel_DeleteDevice();
ENGINE_API CTString IFeel_GetProductName();
ENGINE_API CTString IFeel_GetProjectFileName();
ENGINE_API BOOL IFeel_LoadFile(CTFileName fnFile);
ENGINE_API void IFeel_UnLoadFile();
ENGINE_API void IFeel_PlayEffect(char *pstrEffectName);
ENGINE_API void IFeel_StopEffect(char *pstrEffectName);
ENGINE_API void IFeel_ChangeGain(FLOAT fGain);

#endif  /* include-once check. */
