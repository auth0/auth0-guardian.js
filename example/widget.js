'use strict';

var $ = require('jquery');
var GuardianJS = require('guardian.js');
var $container = $('#container');

var templates = {
  'enroll': {
    'sms': '<div data-enroll><h2>SMS Enrollment</h2>Enter phone number to enroll sms<input name="phone" placeholder="Phone..."><button data-enroll>Enroll</button></div><div data-verify><h2>SMS Enrollment</h2>Sms has been sent please enter the code<input name="otpCode" placeholder="OTP Code..."><button data-enroll>Enroll</button></div>',
    'otp': '<div><h2>Authenticator Enrollment</h2><div data-qr></div><input name="otpCode" placeholder="OTP Code..."><button data-enroll>Enroll</button></div>',
    'push': '<div><h2>Guardian Enrollment</h2><div data-qr></div></div>'
  },
  'login': {
    'sms': '<div><h2>SMS Login</h2><input name="otpCode" placeholder="OTP Code..."><button data-enroll>Verify</button></div>',
    'push': '<div><h2>Push notification login</h2></div>',
    'otp': '<div><h2>OTP Login</h2><input name="otpCode" placeholder="OTP Code..."><button data-enroll>Verify</button></div>'
  },
  'recovery': {
    'code': '<div><h2>Recovery</h2><input name="recoveryCode" placeholder="Recovery Code..."><button data-enroll>Verify</button></div>'
  }
};

var guardianJs = new GuardianJS({
  serviceDomain: 'local.pig.com',
  requestToken: '',

  issuer: {
    name: 'local',
    label: 'Test',
  },
});

guardianJs.start().then(function(transaction) {
  if (transaction.isEnrolled()) {
    var defaultFactor = transaction.startAuth().forDefaultFactor();

    defaultFactor.request();
    var $template = renderTemplate('login', defaultFactor.factor);
    $template.find('[data-verify]').click(function() {
      defaultFactor.verify({ otpCode: $template.find('input').val() })
        .then(function() {
          console.log('Login verified');
        });
    });

  } else {
    console.log('Enroll first')
  }
})
.catch(function(err) {
  console.error('Error', err);
});

guardianJs.on('auth-complete', function(data) {
  console.log('id token', data.idToken);
});

function renderTemplate(type, id) {
  $container.html(template(type, id));

  return $container;
}

function template(type, id) {
  return $(templates[type][id]);
}
