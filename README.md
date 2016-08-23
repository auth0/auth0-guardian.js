# guardian.js

Interface

cost guardian = new GuardianJS({
	requestToken: …,
	serviceDomain: ...
});

guardian.on(‘enrolled’, () => {

});

guardian.on(‘authenticated’, function({ authToken }) {

});

const tx = guardian.startFlow():Transaction;
tx.isEnrolled();
tx.canEnroll();
tx.startAuth();
tx.startEnrollment();

const enroller = tx.startEnrollment(type): EnrollmentFlow throws AlreadyEnrolledException, FactorNotAllowedException
enroller.getFlow(type): {Type}EnrollmentFlow
enroller.getRecoveryCode() throws InvalidStateException

const smsEnrollmentFlowStartStep = (SMSEnrollmentFlowStartStep) enroller.getFlow(’sms’);
const smsSentStepPromise = smsEnrollmentFlowStartStep.enroll({ phoneNumber });
smsSentStepPromise.then(smsSentStep => smsSentStep.verify({ otpCode }));

const pnEnrollmentFlow = (PnEnrollmentFlowStartStep) enroller.getFlow(‘push-notification’);
const qruri = pnEnrollmentFlow.getUri();
const pnEnrollmentExchangedStepPromise = pnEnrollmentFlow.enroll();
pnEnrollmentExchangedPromise.then(() => {...});

const authenticatorEnrollmentStartStep = (AuthenticatorEnrollmentFlow) enroller.getFlow(‘authenticator’);
const qruri = authenticatorEnrollmentStartStep.getUri();
const authenticatorEnrollmentExchangedStepPromise = authenticatorEnrollmentStartStep.enroll();
authenticatorEnrollmentExchangedStepPromise.then((authenticatorEnrollmentExchangedStep) =>
  authenticatorEnrollmentExchangedStep.verify({ [otpCode] }));

const auth = tx.getMainAuthenticator(): {type}Authenticator : Authenticator throws NotEnrolledException

const pnAuthenticator = (PNAuthenticator) auth.getAuthenticator();
const pnAuthenticatorStep = pnAuthenticator.request();
pnAuthenticatorStep.on(‘complete’, function(nextStep) { … });

const smsAuthenticator = (SMSAuthenticator) auth.getAuthenticator();
const smsAuthenticatorStep = smsAuthenticator.request();
smsAuthenticatorStep.on(‘complete’, function(smsAuthenticatorStep2) {
	smsAuthenticatorStep2.verify({ otpCode });
	smsAuthenticatorStep2.on(‘complete’, function() { … })
	smsAuthenticatorStep2.on(‘error’, function() { … })
});
smsAuthenticatorStep.on(‘error’, function(err) {});

const manualInputAuthenticator = (GAAuthenticator) auth.getAuthenticator();
const manualInputAuthenticatorStep = gaAuthenticator.request();
manualInputAuthenticatorStep.on(‘complete’, function(step2) {
	step2.verify({ otpCode })
});
manualInputAuthenticatorStep.on(‘error’, function() {

});

const recoveryCodeAuthenticator = (GAAuthenticator) auth.getAuthenticator();
const recoveryCodeAuthenticatorStep = gaAuthenticator.request();
recoveryCodeAuthenticatorStep.on(‘complete’, function(step2) {
step2.verify({ recoveryCode })
});
recoveryCodeAuthenticatorStep.on(‘error’, function() {

});


Authenticator
#getType(): push-notification|sms|authenticator



