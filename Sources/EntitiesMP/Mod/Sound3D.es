5000
%{
#include "StdH.h"

#include <Engine/Sound/SoundData.h>
#include <Engine/Templates/Stock_CSoundData.h>
%}

class CCecilSound3D : CRationalEntity {
name      "CecilSound";
thumbnail "Thumbnails\\Marker.tbn";

properties:
  1 CTFileName m_fnSound = CTString(""),
  2 INDEX m_iFlags = 0,

 10 CSoundObject m_soSound,
 11 FLOAT m_fFallOff = 20.0f,
 12 FLOAT m_fHotSpot = 5.0f,
 13 FLOAT m_fVolume  = 1.0f,
 14 FLOAT m_fPitch   = 1.0f,

components:

functions:
  void SetParameters(FLOAT fFallOff, FLOAT fHotSpot, FLOAT fVolume, FLOAT fPitch) {
    m_fFallOff = fFallOff;
    m_fHotSpot = fHotSpot;
    m_fVolume = fVolume;
    m_fPitch = fPitch;
  };

procedures:
  Main() {
    InitAsVoid();

    m_soSound.Set3DParameters(m_fFallOff, m_fHotSpot, m_fVolume, m_fPitch);
    PlaySound(m_soSound, m_fnSound, m_iFlags);

    // Get sound length
    FLOAT fLength = 0.0f;

    try {
      CSoundData *psd = _pSoundStock->Obtain_t(m_fnSound);
      fLength = psd->GetSecondsLength();
      _pSoundStock->Release(psd);

    } catch (char *) {
      NOTHING;
    }

    autowait(ClampDn(fLength, ONE_TICK));

    Destroy();
    return;
  }
};

