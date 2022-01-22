5000
%{
#include "StdH.h"
%}

class CCecilSound3D : CRationalEntity {
name      "CecilSound";
thumbnail "Thumbnails\\Marker.tbn";

properties:
  1 CTFileName m_fnSound = CTString(""),
  2 INDEX m_iFlags = 0,
  3 FLOAT m_fWaitTime = 0.0f,

 10 CSoundObject m_soSound,

components:
functions:
  void SetParameters(const FLOAT &fMax, const FLOAT &fMin, const FLOAT &fVolume, const FLOAT &fPitch) {
    m_soSound.Set3DParameters(fMax, fMin, fVolume, fPitch);
  };

procedures:
  Main() {
    InitAsVoid();

    m_soSound.Set3DParameters(20.0f, 5.0f, 1.0f, 1.0f);
    PlaySound(m_soSound, m_fnSound, m_iFlags);

    if (m_fWaitTime > 0.0f) {
      autowait(m_fWaitTime);
    }

    Destroy();
    return;
  }
};

