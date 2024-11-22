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
  3 INDEX m_iTag = -1,

 10 CSoundObject m_soSound,
 11 FLOAT m_fFallOff = 20.0f,
 12 FLOAT m_fHotSpot = 5.0f,
 13 FLOAT m_fVolume  = 1.0f,
 14 FLOAT m_fPitch   = 1.0f,

 20 FLOAT m_tmSoundEndTime = -100.0f,

components:

functions:
  // Set new 3D parameters for the sound
  void SetParameters(FLOAT fFallOff, FLOAT fHotSpot, FLOAT fVolume, FLOAT fPitch) {
    m_fFallOff = fFallOff;
    m_fHotSpot = fHotSpot;
    m_fVolume = fVolume;
    m_fPitch = fPitch;
  };

  // Play setup sound
  void Play(void) {
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

    // Set sound end time
    m_tmSoundEndTime = _pTimer->CurrentTick() + fLength;
  };

procedures:
  Main() {
    InitAsVoid();
    Play();

    while (_pTimer->CurrentTick() < m_tmSoundEndTime) {
      wait (ONE_TICK) {
        on (ETimer) : { stop; }
        otherwise() : { resume; }
      }
    }

    Destroy();
    return;
  }
};

