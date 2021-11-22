#ifndef SE_INCL_PLAYERTARGET_H
#define SE_INCL_PLAYERTARGET_H
#ifdef PRAGMA_ONCE
  #pragma once
#endif

#include <Engine/Base/Synchronization.h>
#include <Engine/Network/NetworkMessage.h>
#include <Engine/Network/ActionBuffer.h>

/*
 * Player target, located in each session state; receiving actions
 */
class CPlayerTarget {
public:
  BOOL plt_bActive;                     // set if this player exists
  CPlayerEntity *plt_penPlayerEntity;   // player entity used by this player
  CTCriticalSection plt_csAction;       // access to player action
  CPlayerAction plt_paPreLastAction;
  CPlayerAction plt_paLastAction;       // last action received (used for delta-unpacking)
  CActionBuffer plt_abPrediction;       // buffer of sent actions (used for prediction)
  FLOAT3D plt_vPredictorPos;            // last position of predictor - for range calculations
public:

  /* Default constructor. */
  CPlayerTarget(void);
  /* Destructor. */
  ~CPlayerTarget(void);

  /* Activate player target for a new player. */
  void Activate(void);
  /* Deactivate player target for removed player. */
  void Deactivate(void);
  /* Check if this player is active. */
  BOOL IsActive(void) { return plt_bActive; };
	/* Attach an entity to this player. */
  void AttachEntity(CPlayerEntity *penClientEntity);

  /* Apply action packet to current actions. */
  void ApplyActionPacket(const CPlayerAction &paDelta);

  /* Remember prediction action. */
  void PrebufferActionPacket(const CPlayerAction &paPrediction);
  // flush prediction actions that were already processed
  void FlushProcessedPredictions(void);
  // get maximum number of actions that can be predicted
  INDEX GetNumberOfPredictions(void);
  /* Apply predicted action with given index. */
  void ApplyPredictedAction(INDEX iAction, FLOAT fFactor);

  /* Read player information from a stream. */
  void Read_t(CTStream *pstr);   // throw char *
  /* Write player information into a stream. */
  void Write_t(CTStream *pstr);  // throw char *
};


#endif  /* include-once check. */

