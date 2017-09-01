(function (undefined) {

    //controller for https://paypong.ua/payments/platezhi-po-rekvizitam page

    angular
        .module('app')
        .controller("P2RController", P2RController);

    P2RController.$inject = ["P2RFactory", "P2RService", "PopupMessage", "receiptService", "AuthFactory", "Secure3D", "StepsModel", "bankCardFactory", "Common", "ProviderFactory", "CardFactory", "$filter"];

    function P2RController(P2RFactory, P2RService, PopupMessage, receiptService, authFactory, Secure3D, StepsModel, bankCardFactory, Common, ProviderFactory, CardFactory, filter) {

        var vm = this;

        vm.CategoriesData = [];
        vm.Cms = getCms;
        vm.CommissionModel = {};
        vm.ConfirmLookup = confirmLookup;
        vm.DataModel = new P2RFactory.DataModel();
        vm.FormatedSenderCard = formatedSenderCard;
        vm.FormatTelNumber = formatTelNumber;
        vm.Forms = {};
        vm.GetCommision = getComission;
        vm.MaskedLookupCode = maskedLookupCode;
        vm.MfoBankData = {};
        vm.OpenReceipt = openReceipt;
        vm.Payment = {};
        vm.PrevTab = prevTab;
        vm.ReceiptEmailModel = {};
        vm.SelectSenderCard = selectSenderCard;
        vm.SenderCardModel = new bankCardFactory.SenderCardModel;
        vm.SendPayment = handleCard;
        vm.SendReceiptToEmail = sendReceiptToEmail;
        vm.Tabs = new StepsModel.Create(['SucessVisible', 'PayInfo', 'CheckInfo', 'smsSubmit']);
        vm.ToDataCheck = toDataCheck;
        vm.ToDataInput = toDataInput;
        vm.TotalAmount = getTotalAmount;
        vm.ExpiredValidation = Common.expiredValidation;
        vm.GetMaxMinSumText = getMaxMinSumText;
        vm.GetCommissionText = getCommissionText;

        checkAuth();
        getCategories();
        getComission();

        //////////////////////////////////////////////////////////////////

        function handleCard() {

            if (vm.SenderCardModel.isAnonCard) {
                var anonymousCard = {
                    CardNumber: vm.SenderCardModel.CardNumber,
                    ExpireMonth: vm.SenderCardModel.ExpireMonth,
                    ExpireYear: vm.SenderCardModel.ExpireYear
                }
                CardFactory.AddAnonymousCard(anonymousCard).then(successCallback, errorCallback);


                function successCallback(res) {
                    vm.SenderCardModel.Id = res.Id;
                    vm.DataModel.CardId = vm.SenderCardModel.Id;
                    sendPayment();
                };
                function errorCallback(err) {
                    PopupMessage.createPopup("Ошибка добавления анонимной карты", "danger");
                };
            } else {
                sendPayment();
            };
        };

        function formatTelNumber(tel) {
            if (tel && tel.length == 13) {
                return tel.substr(0, 3) + ' (' + tel.substr(3, 3) + ') ' + tel.substr(6, 3) + '-' + tel.substr(9, 2) + '-' + tel.substr(11, 2);
            } else {
                return tel;
            };
        };

        function formatedSenderCard() {
            if (vm.SenderCardModel.isAnonCard) {
                return formatCardNumber(vm.SenderCardModel.CardNumber, "1", "vvvv********vvvv");
            } else {
                return formatCardNumber(vm.SenderCardModel.ProtectedCardNumber, "1");
            };
        };

        function formatCardNumber(input, spacesNum, model) {
            if (input && input.length == 16) {
                var returnedVal = [],
                    substrCard,
                    spaces = Array(Number(spacesNum) + 1).join(" ");
                if (model && model.length == 16) {
                    var modelArr = model.split("");
                    input = input.split("");
                    modelArr.forEach(function (item, index) {
                        if (item != "v") {
                            input[index] = item;
                        };
                    });
                    input = input.join("");
                }
                for (var i = 1; i <= 4; i++) {
                    var substrCard = input.substr((i - 1) * 4, 4);
                    returnedVal.push(substrCard);
                }

                return returnedVal.join(spaces);
            } else {
                return input;
            };
        };

        function prevTab() {
            vm.Tabs.PrevTab();
        };

        function toDataCheck() {
            if (vm.Forms.DataInput.$valid) {
                vm.Tabs.SetTab("CheckInfo");
            };
        };

        function toDataInput() {
            vm.Tabs.SetTab("PayInfo");
        }

        function getCms() {
            if (vm.CommissionModel && vm.DataModel.Amount && !isNaN(vm.DataModel.Amount)) {
                var ComisAmount = calculateCms(Number(vm.DataModel.Amount), vm.CommissionModel);
                if (Number(ComisAmount) < Number(vm.CommissionModel.MinCommissionValue)) ComisAmount = vm.CommissionModel.MinCommissionValue;
                else if (Number(ComisAmount) > Number(vm.CommissionModel.MaxCommissionValue) && Number(vm.CommissionModel.MaxCommissionValue) != 0) ComisAmount = vm.CommissionModel.MaxCommissionValue;
                if (!isNaN(ComisAmount)) {
                    return ComisAmount;
                };
            }
        };

        function getTotalAmount() {
            var totalSum = Math.round((Number(vm.DataModel.Amount) + Number(getCms())) * 100) / 100;
            if (!isNaN(totalSum)) {
                return totalSum;
            }
        };

        function getComission() {
            ProviderFactory.GetProviderInfo(vm.DataModel.ProviderCode).then(function (data) {
                vm.CommissionModel = data.TariffCommission;
            });
        };

        function getCategories() {
            P2RService.GetCategories().then(successCallback, errorCallback);

            function successCallback(data) {
                vm.CategoriesData = data;
                setActiveCategory();

                function setActiveCategory() {
                    var abonentAccount = $("#abonentAccount").val();

                    if (abonentAccount && abonentAccount.length) {
                        var categoryValue = abonentAccount.substring(0, abonentAccount.indexOf("; "));
                        var categoryObj = filter("filter")(vm.CategoriesData, { NameRu: categoryValue }, true);
                        if (angular.isObject(categoryObj)) {
                            vm.DataModel.PaymentToAccountCategoryId = categoryObj.Id;
                        };
                    };
                };
            };

            function errorCallback(err) {
                PopupMessage.createPopup("Ошибка загрузки списка категорий платежей", "danger")
            };

        }

        function selectSenderCard(card) {

            if (card.ProtectedCardNumber) {
                if (Common.expiredValidation(card.ExpirationDate)) {
                    PopupMessage.createPopup("Истёк срок действия банковской карты", "danger");
                    return null;
                };
                vm.SenderCardModel.isAnonCard = false;
                var expireDate = new Date(card.ExpirationDate);
                vm.SenderCardModel.ExpireMonth = (expireDate.getMonth() + 1).toString();
                vm.SenderCardModel.ExpireYear = expireDate.getFullYear().toString();
                vm.SenderCardModel.Cvv = null;
                vm.SenderCardModel.Id = card.Id;
                vm.SenderCardModel.ProtectedCardNumber = card.ProtectedCardNumber;
                vm.SenderCardModel.BinType = card.BinType;
            } else {
                vm.SenderCardModel.isAnonCard = true;
                vm.SenderCardModel.ExpireMonth = null;
                vm.SenderCardModel.ExpireYear = null;
                vm.SenderCardModel.Cvv = null;
                vm.SenderCardModel.Id = null;
                vm.SenderCardModel.ProtectedCardNumber = null;
                vm.SenderCardModel.BinType = null;
                vm.SenderCardModel.CardNumber = null;
            };

        };

        function checkAuth() {
            return authFactory.CheckAuth().then(function (res) {
                vm.isAuthUser = res;
            });
        }

        function openReceipt() {
            receiptService.DownloadReceiptPdf(vm.Payment.Id, 1);
        };

        function sendPayment() {
            vm.DataModel.CardId = vm.SenderCardModel.Id;
            vm.DataModel.Cvv = vm.SenderCardModel.Cvv;
            P2RService.AddPayment(vm.DataModel).then(successCallback, errorCallback);

            function successCallback(data) {
                if (data && data.Status && (data.Status.Code === 122 || data.Status.Code === 124) && data.Secure3D != null) {
                    vm.Secure3D = data.Secure3D;
                    if (vm.Secure3D.PaReq === "lookup" || data.Status.Code === 124) {
                        vm.Secure3D.PaReq = "";
                        vm.Payment.Id = data.PaymentId;
                        vm.Payment.LookupId = data.LookupId;
                        vm.Tabs.SetTab("smsSubmit");
                        $("html, body").stop().animate({ scrollTop: 82 }, '500', 'swing');
                    } else {
                        Secure3D.Submit(vm.Secure3D);
                    }
                }
                else if (data && data.Status && (data.Status.Code === 127 || data.Status.Code === 100)) {
                    // success operation
                    vm.Payment.Id = data.PaymentId;
                    vm.Payment.TransactionNumber = data.TransactionNumber;
                    vm.Tabs.SetTab("SucessVisible");
                } else {
                    vm.errorCode = data.Status.DescriptionRu;
                    PopupMessage.createPopup(vm.errorCode, "danger");
                }
            };

            function errorCallback(error) {
                PopupMessage.createPopup(error.Message || 'Неправильно заполнены данные', "danger");
            };
        };

        function confirmLookup() {
            if (vm.Forms.transferSubmit.$valid) {
                var lookupModel = {
                    PaymentToAccountCategoryId: vm.DataModel.PaymentToAccountCategoryId,
                    PaymentId: vm.Payment.Id,
                    LookupId: vm.Payment.LookupId,
                    LookupCode: vm.Payment.LookupCode,
                    Cvv: vm.SenderCardModel.Cvv
                };

                P2RService.ConfirmLookupPayment(lookupModel).then(successCallback, errorCallback);

                function successCallback(data) {
                    if (data && data.Status && data.Status.Code == 100) {
                        vm.Tabs.SetTab("SucessVisible");
                        vm.Payment.TransactionNumber = data.TransactionNumber;
                    } else if (data && data.Status && data.Status.Code == 108) {
                        PopupMessage.createPopup(data.Status.DescriptionRu || 'Ошибка проверки платежа', 'danger');
                    } else {
                        window.location.href = '/status/error';
                    };
                };

                function errorCallback(err) {
                    PopupMessage.createPopup(err.Message || 'ошибка сервера', 'danger');
                };
            }

        };

        function maskedLookupCode() {
            if (vm.Payment.LookupCode) {
                var codeLength = vm.Payment.LookupCode.length + 1;
                return Array(codeLength).join("*");
            };
        };

        function sendReceiptToEmail() {
            if (vm.Forms.sendEmail.$valid) {
                vm.ReceiptEmailModel.transactionNumber = vm.Payment.TransactionNumber;
                receiptService.SendEmailPaymentReceipt(vm.ReceiptEmailModel).then(function () {
                    PopupMessage.createPopup('Отправлено письмо на ' + vm.ReceiptEmailModel.EmailTo, 'info');
                    vm.ReceiptEmailModel.EmailTo = "";
                    vm.Forms.sendEmail.$setPristine();
                }, function (err) {
                    PopupMessage.createPopup(err.Message || 'Не удалось отправить письмо', 'danger');
                });
            }
        };

        function getMaxMinSumText() {
            if (vm.CommissionModel) {
                return "Введите сумму от " + vm.CommissionModel.MinAmount + " до " + vm.CommissionModel.MaxAmount + " грн";
            };
        }

        function getCommissionText() {
            if (vm.CommissionModel) {
                var additionalCommiss = vm.CommissionModel.AdditionalValue == 0 ? "" : " + " + vm.CommissionModel.AdditionalValue + ' грн'
                return "Комиссия " + vm.CommissionModel.Value + '%' + additionalCommiss;
            };
        }
    }


})();