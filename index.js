'use strict';

const EventEmitter = require('events').EventEmitter;
const Transaction = require('./lib/transaction');
const guardianHttpClient = require('./lib/utils/guardian_request');
const GuardianSocket = require('./lib/utils/guardian_socket');
const errors = require('./lib/errors');
const factorEntity = require('./lib/entities/factor');
const enrollmentEntity = require('./lib/entities/enrollment');
const Promise = require('promise-polyfill');
const JWTToken = require('./lib/utils/jwt_token');
const asyncEmit = require('./lib/utils/async_emit');
const object = require('./lib/utils/object');
const NullSocket = require('./lib/utils/null_socket');
const formPostCallbackPlugin = require('./lib/plugins/form_post_callback');

class Auth0GuardianJS {

  /**
   * Creates a new instance of the client. The client is mostly based on the
   * transaction, so apart from listening to events you will probably need to
   * start the transaction calling #start()
   *
   * @param {string} options.serviceDomain
   * @param {string} options.requestToken
   * @param {string} options.issuer.label
   * @param {string} options.issuer.name
   * @param {boolean} [options.disableSocket=false]
   *
   * @param {GuardianClient} dependencies.guardianClient
   * @param {GuardianSocket} dependencies.guardianSocket
   */
  constructor(options, configuration, dependencies) {
    dependencies = dependencies || {};

    this.events = new EventEmitter();
    this.issuer = options.issuer;
    this.requestToken = new JWTToken(options.requestToken);

    this.guardianClient = dependencies.guardianClient || guardianHttpClient({ serviceDomain: options.serviceDomain });

    const socket = options.disableSocket ? new NullSocket() : new GuardianSocket({ baseUri: this.guardianClient.getBaseUri() });
    this.guardianSocket = dependencies.guardianSocket || socket;

    this.handleLoginComplete = this.handleLoginComplete.bind(this);
    this.handleLoginRejected = this.handleLoginRejected.bind(this);
    this.handleEnrollmentComplete = this.handleEnrollmentComplete.bind(this);
    this.handleRequestTimeout = this.handleRequestTimeout.bind(this);
    this.handleTransactionTimeout = this.handleTransactionTimeout.bind(this);
    this.handleError = this.handleError.bind(this);

    this.requestToken.once('token-expired', this.handleRequestTimeout);

    this.transaction = null;
  }

  /**
   * Handle a login complete message, keep in mind that this message is really
   * tied to the transaction, so you should not receive a login complete message
   * if you haven't started a transaction
   *
   * @param {string} loginPayload.signature Authentication token
   * @deprecated @param {string} [loginPayload.payload] Decoded payload
   *
   * When: when login is accepted for CURRENT transaction
   */
  handleLoginComplete(loginPayload) {
    let factor;

    const wasEnrollment = !this.transaction.isEnrolled();

    if (wasEnrollment) {
      //  HACK: we need to send all this data for all factors, right now it is
      //  only sent for push and the information is pretty limited, this
      //  is responsible for an known edge case with two parallel browsers.

      //  api/issues/291
      factor = this.transaction.getCurrentFactor();

      if (factor && factor !== 'push') {
        const enrollmentPayload =  {
          factor: factor,
          enrollment: { status: 'confirmed' },
          transactionComplete: true
        };

        this.transaction.markEnrolled(enrollmentPayload);

        // Remove once api/issues/291 get solved
        this.events.emit('enrollment-complete', enrollmentPayload);
      }
    } else {
      factor = this.transaction.getCurrentFactor();
    }

    process.nextTick(() => {
      this.events.emit('login-complete', {
        factor: factor,
        wasEnrollment: wasEnrollment,
        recovery: !factor,
        accepted: true,
        loginPayload: loginPayload
      });

      // Once we have login the transaction have ended, no more events make sence
      // at this point, so let's cleanup resources
      this.end();
    });
  }

  /**
   * Handles rejection events from server
   *
   * When: when login was rejected for CURRENT transaction
   */
  handleLoginRejected() {
    // The only factor that supports rejection right now is push
    this.events.emit('login-rejected', {
        factor: 'push',
        recovery: false,
        accepted: false,
        loginPayload: null
      });
  }

  /**
   * Handles the enrollment complete message from the server. This message might
   * be received at any point of the transaction if it has been completed from
   * a different browser
   *
   * HACK: we need to send all this data for all factors, right now it is
   * only sent for push and the information is pretty limited, this
   * is responsible for an known edge case with two parallel browsers.
   *
   * api/issues/291
   *
   * When: when enrollment was completed from ANY transaction (see comment above)
   */
  handleEnrollmentComplete(data) {
    const enrollmentPayload = {
      factor: 'push',
      transactionComplete: false,
      enrollment: object.assign({
        status: 'confirmed',
        pushNotifications: { enabled: true }
      }, data.enrollment)
    };

    // There will be always an active transaction if we
    // receive socket events, we don't listen for them before
    // transaction have been created
    this.transaction.markEnrolled(enrollmentPayload);

    this.events.emit('enrollment-complete', enrollmentPayload);
  }

  /**
   * Transaction token timeout handler
   *
   * When: when transaction token expires
   *
   * @private
   */
  handleTransactionTimeout() {
    this.events.emit('timeout', new errors.TransactionTokenExpired());
  }

  /**
   * Request token timeout handler
   *
   * When: when request token expires
   *
   * @private
   */
  handleRequestTimeout() {
    this.events.emit('timeout', new errors.RequestTokenExpired());
  }

  /**
   * Socket error handler
   *
   * @private
   */
  handleError(err) {
    this.events.emit('error', err);
  }

  /**
   * Start listening server errors
   *
   * @private
   */
  startListening(transactionToken) {
    this.guardianSocket.on('login-complete', this.handleLoginComplete);
    this.guardianSocket.on('login-rejected', this.handleLoginRejected);
    this.guardianSocket.on('enrollment-complete', this.handleEnrollmentComplete);
    this.guardianSocket.on('error', this.handleError);

    this.guardianSocket.open(transactionToken.getToken());
  }

  /**
   * Starts a Guardian login transaction
   *
   * @public
   */
  start() {
    // If you have only one request token having more than one transaction active
    // doesn't make sence.
    if (this.startingTransaction || this.transaction) {
      return Promise.reject(new errors.NotValidStateError('Transaction is already stared or starting'));
    }

    this.startingTransaction = true;

    if (this.requestToken.isExpired()) {
      return Promise.reject(new errors.RequestTokenExpired());
    }

    return this.guardianClient.post('/start-flow', this.requestToken.getToken())
      .then((txData) => {
        const factors = {
          sms: {
            enabled: txData.featureSwitches.mfaSms.enroll
          },
          push: {
            enabled: txData.featureSwitches.mfaApp.enroll
          }
        };

        const enrollment = txData.deviceAccount;

        if (!factorEntity.isAnyFactorEnabled(factors) &&
            !enrollmentEntity.isEnrollmentConfirmed(enrollment)) {
          return Promise.reject(new errors.EnrollmentNotAllowedError());
        }

        // The request token is not going to be used anymore, now we are
        // interested on the transaction token
        this.requestToken.removeListener('token-expired', this.handleRequestTimeout);

        const transactionToken = new JWTToken(txData.transactionToken);
        transactionToken.once('token-expired', this.handleTransactionTimeout);

        const data = {
          enrollment: enrollment,
          issuer: this.issuer,
          transactionToken: transactionToken,
          factors: factors
        };

        // If there is a recovery code let's keep it separated from
        // the rest of data (multi device)
        if (txData.deviceAccount.recoveryCode) {
          data.recoveryCode = txData.deviceAccount.recoveryCode;
        }

        // enrollmentTxId will only be present on enrollments
        if (txData.enrollmentTxId) {
          data.enrollmentTxId = txData.enrollmentTxId;
        }

        const tx = new Transaction(data, null, {
          guardianClient: this.guardianClient
        });

        this.transaction = tx;

        // Before the transaction have started we are not interested
        // in the events since before that point we won't even known
        // if the device it enrolled
        this.startListening(transactionToken);

        // finally
        this.startingTransaction = false;

        return tx;
      })
      .catch((err) => {

        // finally
        this.startingTransaction = false;

        return Promise.reject(err);
      });
  }

  /**
   * Ends the transaction and cleanup resources
   *
   * @public
   */
  end() {
    this.requestToken.removeAllListeners();
    this.transaction.getTransactionToken().removeAllListeners();
    this.startingTransaction = false;
    this.transaction = null;
  }
};

Auth0GuardianJS.plugins = {
  formPostCallback: formPostCallbackPlugin
};

global.GuardianJS = module.exports = Auth0GuardianJS;
