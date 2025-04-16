/**
 * Commerce Braintree plugin for Craft CMS
 *
 * Commerce Braintree JS
 *
 * @author    Kurious Agency
 * @copyright Copyright (c) 2018 Kurious Agency
 * @link      https://kurious.agency
 * @package   CommerceBraintree
 * @since     1.0.0
 */

(function() {
	(function check() {
		if (typeof braintree !== 'undefined') {
			init();
		} else {
			setTimeout(check, 50);
		}
	})();
	
	window.commerceBT = {
		callbacks:{},
		methodSelected:false,
	};

	function init($) {
		document.querySelectorAll('form').forEach(function($form) {
			var $token = $form.querySelector('[name*="gatewayToken"]'),
				$nonce = $form.querySelector('[name*="nonce"]'),
				$deviceDataInput = $form.querySelector('[name="deviceData"]'),
				amount = $form.querySelector('[name*="amount"]')?.value,
				currency = $form.querySelector('[name*="currency"]')?.value,
				email = $form.querySelector('[name*="email"]')?.value,
				address = $form.querySelector('[name*="address"]')?.value,
				$dropinUi = $form.querySelector('[data-id="dropInUi"]'),
				$submit = $form.querySelector('button[type="submit"]');

			if ($dropinUi) {
				if (!$submit.dataset.manual) {
					$submit.dataset.text = $submit.innerHTML;
				}
				if ($submit.dataset.loading) {
					$submit.disabled = true;
					if ($submit.dataset.manual) {
						$submit.dataset.loading = true;
					} else {
						$submit.innerHTML = $submit.dataset.loading;
					}
				}

				var options = {
					authorization: $token.value,
					container: $dropinUi,
					locale: $dropinUi.dataset.locale,
					vaultManager: $dropinUi.dataset.manage,
					card: {
						cardholderName: {
							required: true
						},
						vault: {
							vaultCard: true,
							allowVaultCardOverride: true
						}
					}
				};
				if ($dropinUi.dataset.translations != '') {
					options.translations = JSON.parse($dropinUi.dataset.translations);
				}

				if (Boolean($dropinUi.dataset.subscription) != true) {
					options.paypal = {
						flow: 'checkout',
						env: $dropinUi.dataset.sandbox ? 'sandbox' : 'production',
						amount: amount,
						currency: currency,
						buttonStyle: {
							color: 'blue',
							shape: 'rect',
							size: 'responsive',
							label: 'paypal'
						}
					};

					options.applePay = {
						displayName: $dropinUi.dataset.name,
						paymentRequest: {
							total: {
								label: $dropinUi.dataset.name,
								amount: amount
							}
						}
					};

					options.googlePay = {
						merchantId: $dropinUi.dataset.googlePayId,
						googlePayVersion: 2,
						transactionInfo: {
							countryCode: address ? JSON.parse(address).countryCodeAlpha2 : '',
							currencyCode: currency,
							totalPriceStatus: 'FINAL',
							totalPrice: amount
						}
					};
				} else {
					options.card.vault.allowVaultCardOverride = false;
				}

				if ($dropinUi.dataset.threedsecure) {
					options.threeDSecure = true;
				}

				options.dataCollector = true;

				console.log(options);

				braintree.dropin.create(options, function(err, dropinInstance) {
					if (err) {
						console.error(err);
						if (window.braintreeError) {
							window.braintreeError(err);
						}
						return;
					}
					
					if ($submit.dataset.manual) {
						$submit.dataset.loading = false;
					} else {
						$submit.innerHTML = $submit.dataset.text;
					}

					if (dropinInstance.isPaymentMethodRequestable()) {
						reset($submit);
					}
					//need for vault
					dropinInstance.on('paymentMethodRequestable', function(e) {
						if (!window.commerceBT.methodSelected) {
							$form.addEventListener('submit', formSubmit);
							reset($submit);
						}
					});
					dropinInstance.on('noPaymentMethodRequestable', function(e) {
						disable($submit);
					});
					dropinInstance.on('paymentOptionSelected', function(e) {
						window.commerceBT.methodSelected = false;
						$form.removeEventListener('submit', formSubmit);
						//processing($submit);
						if (window.commerceBT.callbacks.hasOwnProperty('onPaymentMethodSelect')) {
							window.commerceBT.callbacks.onPaymentMethodSelect();
						} else {
							processing($submit);
						}
					});

					window.commerceBT.options = {
						dropinInstance: dropinInstance,
						threeDSecure: $dropinUi.dataset.threedsecure,
						options: {
							threeDSecure: {
								amount: amount,
								email: email,
								billingAddress: address ? JSON.parse(address) : address
							}
						}
					}
					//$form.addEventListener('submit', formSubmit);
				});
			}
		});
	}

	function formSubmit(e) {
		e.preventDefault();
		var $deviceDataInput = e.currentTarget.querySelector('[name="deviceData"]');
		
		//console.log(e)
		var dropinInstance = e.data.dropinInstance,
			$form = $(e.currentTarget),
			threeDSecure = e.data.threeDSecure,
			$submit = $form.find('button[type="submit"]');
		processing($submit);

		dropinInstance.requestPaymentMethod(threeDSecure ? window.commerceBT.options.options : {}, function(err, payload) {
			if (err) {
				console.error(err);
				if (window.braintreeError) {
					window.braintreeError(err);
				}
				reset($submit);
				return;
			}
			//console.log(payload);

			if(payload.deviceData && $deviceDataInput) {
				$deviceDataInput.value = payload.deviceData;
			}

			if ((payload.liabilityShiftPossible && payload.liabilityShifted) || !payload.liabilityShiftPossible || payload.type !== 'CreditCard' || !threeDSecure) {
				processing($submit);
				$form.querySelector('input[name*=nonce]').value = payload.nonce;
				$form.removeEventListener('submit', formSubmit);
				window.commerceBT.methodSelected = true;
				if (window.commerceBT.callbacks.hasOwnProperty('onPaymentMethodReady')) {
					window.commerceBT.callbacks.onPaymentMethodReady();
				} else {
					$form.submit();
				}
			} else {
				if (window.braintreeError) {
					window.braintreeError('3ds failed');
				}
				//dropinInstance.clearSelectedPaymentMethod();
				reset($submit);
				//$submit.prop('disabled', true);
			}
		});
	}
	function disable($button) {
		$button.disabled = true;
	}
	function reset($button) {
		$button.disabled = false;
		if ($button.dataset.manual) {
			$button.dataset.processing = false;
		} else {
			$button.innerHTML = $button.dataset.text;
		}
	}
	function processing($button) {
		$button.disabled = true;
		if ($button.dataset.manual) {
			$button.dataset.processing = true;
		} else {
			if ($button.dataset.processing) {
				$button.innerHTML = $button.dataset.processing;
			}
		}
	}
})();
