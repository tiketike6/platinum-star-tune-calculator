/* eslint-disable max-statements */
(function () {
    // dayjsのロケール設定
    dayjs.locale('ja');

    // コース毎の元気コストの設定
    const staminaCost = {
        _2m_live: 15,
        _2m_work: 15,
        _4m_live: 20,
        _4m_work: 20,
        _2p_live: 25,
        _2p_work: 25,
        _6m_live: 25,
        _6m_work: 25,
        _mm_live: 30,
        _mm_work: 30,
    };

    // コース毎の獲得ptの設定
    const points = {
        _2m_live: 25,
        _2m_work: 25 * 0.7,
        _4m_live: 39,
        _4m_work: 39 * 0.7,
        _2p_live: 52,
        _2p_work: 52 * 0.7,
        _6m_live: 54,
        _6m_work: 54 * 0.7,
        _mm_live: 75,
        _mm_work: 75 * 0.7,
    };

    // イベント楽曲の設定
    const consumedItemPerEvent = 140;
    const earnPointsPerEvent = 490;

    // 入力値の取得
    function getFormValue() {
        const formValue = {};
        const errors = [];

        if ($('#isNow').prop('checked')) {
            $('#now').val(dayjs().format('YYYY-MM-DDTHH:mm'));
        }

        function validDateTime(field) {
            const inputValue = $(`#${field}`).val();
            if (!inputValue) {
                errors.push({
                    field: field,
                    message: '必須です。',
                });
            } else if (!dayjs(inputValue).isValid()) {
                errors.push({
                    field: field,
                    message: '日時の入力例は「2017-06-29T15:00」です。',
                });
            } else {
                formValue[field] = inputValue;
                formValue[`${field}Unix`] = dayjs(inputValue).unix();
            }
        }
        validDateTime('start');
        validDateTime('end');
        validDateTime('now');

        if (formValue.nowUnix < formValue.startUnix) {
            formValue.nowUnix = formValue.startUnix;
            formValue.isFuture = true;
        }
        if (formValue.nowUnix > formValue.endUnix) {
            formValue.nowUnix = formValue.endUnix;
        }

        formValue.endOfTodayUnix = dayjs(formValue.now).endOf('d').unix();
        if (formValue.endOfTodayUnix < formValue.startUnix) {
            formValue.endOfTodayUnix = formValue.startUnix;
        }
        if (formValue.endOfTodayUnix > formValue.endUnix) {
            formValue.endOfTodayUnix = formValue.endUnix;
        }

        function validSafeInteger(field) {
            const inputValue = $(`#${field}`).val();
            if (!inputValue) {
                errors.push({
                    field: field,
                    message: '必須です。',
                });
            } else if (!Number.isSafeInteger(Number(inputValue))) {
                errors.push({
                    field: field,
                    message: '有効な値ではありません。',
                });
            } else {
                formValue[field] = Number(inputValue);
            }
        }
        validSafeInteger('target');
        validSafeInteger('stamina');
        validSafeInteger('liveTicket');
        validSafeInteger('myPoint');
        validSafeInteger('myItem');
        validSafeInteger('eventBonus');
        validSafeInteger('mission');

        formValue.workStaminaCost = Number($('[name="workStaminaCost"]:checked').val());
        formValue.staminaCostMultiplier = Number($('[name="staminaCostMultiplier"]:checked').val());
        formValue.ticketCostMultiplier = Number($('#ticketCostMultiplier').val());
        formValue.itemsCostMultiplier = Number($('[name="itemsCostMultiplier"]:checked').val());
        formValue.showCourse = $('[name="showCourse"]:checked')
            .map((i) => {
                return $('[name="showCourse"]:checked').eq(i).val();
            })
            .get();
        formValue.isAutoSave = $('#autoSave').prop('checked');
        formValue.inTable = {};
        formValue.inTable.workStaminaCost = {};
        formValue.inTable.itemsCostMultiplier = {};
        Object.keys(staminaCost).forEach((course) => {
            formValue.inTable.workStaminaCost[course] = Number($(`[name="workStaminaCost${course}"]:checked`).val());
            formValue.inTable.itemsCostMultiplier[course] = Number($(`[name="itemsCostMultiplier${course}"]:checked`).val());
        });

        $('.error').remove();
        if (errors.length) {
            errors.forEach((error) => {
                $(`#${error.field}`).after(`<span class="error">${error.message}</span>`);
            });
            return null;
        }
        return formValue;
    }

    // 目標ポイントを計算
    function calculateTargetPoint(formValue) {
        let diffTarget = formValue.target - formValue.myPoint;
        if (diffTarget < 0) {
            diffTarget = 0;
        }
        $('#diffTarget').text(`(あと ${diffTarget.toLocaleString()} pt)`);

        $('#todaysLabel').text(`【${dayjs.unix(formValue.endOfTodayUnix).format('M/D')}の目標】`);

        const todaysTarget = Math.round(
            (formValue.target * (formValue.endOfTodayUnix - formValue.startUnix)) / (formValue.endUnix - formValue.startUnix)
        );
        let diffToday = todaysTarget - formValue.myPoint;
        if (diffToday < 0) {
            diffToday = 0;
        }
        $('#todaysTarget').text(`${todaysTarget.toLocaleString()} pt (あと ${diffToday.toLocaleString()} pt)`);

        $('#nowLabel').text(`【${dayjs.unix(formValue.nowUnix).format('M/D H:mm')}の目標】`);

        const nowTarget = Math.round((formValue.target * (formValue.nowUnix - formValue.startUnix)) / (formValue.endUnix - formValue.startUnix));
        let diffNow = nowTarget - formValue.myPoint;
        if (diffNow < 0) {
            diffNow = 0;
        }
        $('#nowTarget').text(`${nowTarget.toLocaleString()} pt (あと ${diffNow.toLocaleString()} pt)`);
    }

    // ログインボーナスを考慮
    function calculateLoginBonus(formValue) {
        const loginBonusPerDay = 420;
        let loginBonus = dayjs.unix(formValue.endUnix).endOf('d').diff(dayjs.unix(formValue.nowUnix), 'd') * loginBonusPerDay;
        if (formValue.isFuture) {
            loginBonus += loginBonusPerDay;
        }
        $('#loginBonus').text(`+ ログインボーナス ${loginBonus.toLocaleString()} 個`);
        formValue.loginBonus = loginBonus;

        const earnPointsPerEventWithBonus = earnPointsPerEvent + Math.ceil((earnPointsPerEvent * formValue.eventBonus) / 100);
        $('#expectedPoint').text(
            `(アイテム消費後 ${(
                formValue.myPoint +
                earnPointsPerEventWithBonus * Math.floor(formValue.myItem / consumedItemPerEvent)
            ).toLocaleString()} pt)`
        );
    }

    // コース毎の計算
    function calculateByCouse(course, formValue, result, minCost) {
        if (formValue.showCourse.length && formValue.showCourse.indexOf(course) === -1) {
            // 表示コースでなければ計算しない
            return;
        }

        const earnPointsPerEventWithBonus = earnPointsPerEvent + Math.ceil((earnPointsPerEvent * formValue.eventBonus) / 100);
        const isWork = course.indexOf('work') !== -1;

        let myItem = formValue.myItem + formValue.loginBonus;

        let liveTimes = 0;
        let consumedStamina = 0;
        let liveEarnedPoint = 0;

        let eventTimes = 0;
        let consumedItem = 0;
        let eventEarnedPoint = 0;

        // チケットライブで目標達成できるか判定
        function recommendTicketCostMultiplier() {
            let i = 1;
            for (i = 1; i <= formValue.ticketCostMultiplier; i++) {
                if (
                    formValue.target <= formValue.myPoint + liveEarnedPoint + eventEarnedPoint + Math.ceil(points[course] * i) &&
                    formValue.mission <= eventTimes
                ) {
                    // チケットライブのみで目標達成
                    return i;
                }
            }
            for (i = 1; i <= formValue.ticketCostMultiplier; i++) {
                if (
                    formValue.target <=
                        formValue.myPoint + liveEarnedPoint + eventEarnedPoint + Math.ceil(points[course] * i) + earnPointsPerEventWithBonus &&
                    consumedItemPerEvent <= myItem + Math.ceil(points[course] * i) &&
                    formValue.mission <= eventTimes + 1
                ) {
                    // チケットライブとイベント楽曲で目標達成
                    return i;
                }
            }
            return formValue.ticketCostMultiplier;
        }

        // 通常楽曲回数、イベント楽曲回数を計算
        while (formValue.target > formValue.myPoint + liveEarnedPoint + eventEarnedPoint || formValue.mission > eventTimes) {
            // 累積ptが最終目標pt以上になるか、イベント楽曲回数がミッション以上になるまで繰り返し
            if (myItem >= consumedItemPerEvent) {
                // アイテムを所持している場合、イベント楽曲
                myItem -= consumedItemPerEvent;
                eventTimes++;
                consumedItem += consumedItemPerEvent;
                eventEarnedPoint += earnPointsPerEventWithBonus;
            } else if (isWork) {
                // アイテムを所持していない場合、チケットライブ
                const recommendedTicketCostMultiplier = recommendTicketCostMultiplier();
                liveTimes += recommendedTicketCostMultiplier;
                consumedStamina += staminaCost[course] * recommendedTicketCostMultiplier;
                liveEarnedPoint += Math.ceil(points[course] * recommendedTicketCostMultiplier);
                myItem += Math.ceil(points[course] * recommendedTicketCostMultiplier);
            } else {
                // アイテムを所持していない場合、通常楽曲
                liveTimes++;
                consumedStamina += staminaCost[course];
                liveEarnedPoint += points[course];
                myItem += points[course];
            }
        }

        // ミッションを考慮したイベント楽曲回数を計算
        function calculateEventTimesForMission() {
            const maxTimesOf4 = formValue.itemsCostMultiplier >= 4 ? Math.floor(eventTimes / 4) : 0;
            for (let timesOf4 = maxTimesOf4; timesOf4 >= 0; timesOf4--) {
                const maxTimesOf2 = formValue.itemsCostMultiplier >= 2 ? Math.floor((eventTimes - timesOf4 * 4) / 2) : 0;
                for (let timesOf2 = maxTimesOf2; timesOf2 >= 0; timesOf2--) {
                    const timesOf1 = eventTimes - timesOf4 * 4 - timesOf2 * 2;
                    if (timesOf4 + timesOf2 + timesOf1 >= formValue.mission) {
                        // 合計がミッション回数以上なら達成可能
                        return {
                            4: timesOf4,
                            2: timesOf2,
                            1: timesOf1,
                        };
                    }
                }
            }
            return {
                4: 0,
                2: 0,
                1: eventTimes,
            };
        }
        const fixedEventTimes = calculateEventTimesForMission();

        // お仕事回数の計算
        function calculateWorkTimes() {
            if (!isWork) {
                return {
                    consumedStamina: consumedStamina,
                    30: 0,
                    25: 0,
                    20: 0,
                };
            }
            const workTimes = {
                consumedStamina: Math.ceil(consumedStamina / formValue.workStaminaCost) * formValue.workStaminaCost,
                30: 0,
                25: 0,
                20: 0,
            };
            workTimes[formValue.workStaminaCost] = Math.ceil(consumedStamina / formValue.workStaminaCost);
            const workStaminaCost = [30, 25, 20].filter((cost) => cost !== formValue.workStaminaCost);
            const maxTimesOfSelected = Math.ceil(consumedStamina / formValue.workStaminaCost);
            for (let timesOfSelected = maxTimesOfSelected; timesOfSelected >= 0; timesOfSelected--) {
                const maxTimesOf0 = Math.ceil((consumedStamina - timesOfSelected * formValue.workStaminaCost) / workStaminaCost[0]);
                for (let timesOf0 = maxTimesOf0; timesOf0 >= 0; timesOf0--) {
                    const maxTimesOf1 = Math.ceil(
                        (consumedStamina - timesOfSelected * formValue.workStaminaCost - timesOf0 * workStaminaCost[0]) / workStaminaCost[1]
                    );
                    for (let timesOf1 = maxTimesOf1; timesOf1 >= 0; timesOf1--) {
                        const earnedLiveTicket =
                            timesOfSelected * formValue.workStaminaCost + timesOf0 * workStaminaCost[0] + timesOf1 * workStaminaCost[1];
                        if (earnedLiveTicket + formValue.liveTicket === consumedStamina) {
                            // チケット枚数が消費枚数と同じなら無駄ゼロ
                            workTimes.consumedStamina = earnedLiveTicket;
                            workTimes[formValue.workStaminaCost] = timesOfSelected;
                            workTimes[workStaminaCost[0]] = timesOf0;
                            workTimes[workStaminaCost[1]] = timesOf1;
                            return workTimes;
                        }
                        if (earnedLiveTicket + formValue.liveTicket < consumedStamina) {
                            // チケット枚数が消費枚数未満なら達成不能
                            continue;
                        }
                        if (earnedLiveTicket < workTimes.consumedStamina) {
                            // チケット枚数が最小なら格納
                            workTimes.consumedStamina = earnedLiveTicket;
                            workTimes[formValue.workStaminaCost] = timesOfSelected;
                            workTimes[workStaminaCost[0]] = timesOf0;
                            workTimes[workStaminaCost[1]] = timesOf1;
                        }
                    }
                }
            }
            return workTimes;
        }
        const fixedWorkTimes = calculateWorkTimes();
        const consumedLiveTicket = consumedStamina;
        consumedStamina = fixedWorkTimes.consumedStamina;

        // 所要時間の計算
        function calculateRequiredMinutes() {
            // お仕事
            let requiredMinutes =
                0.5 *
                (Math.ceil(fixedWorkTimes[30] / formValue.staminaCostMultiplier) +
                    Math.ceil(fixedWorkTimes[25] / formValue.staminaCostMultiplier) +
                    Math.ceil(fixedWorkTimes[20] / formValue.staminaCostMultiplier));
            if (isWork) {
                // チケットライブ
                requiredMinutes += 3 * Math.ceil(liveTimes / formValue.ticketCostMultiplier);
            } else {
                // 通常楽曲
                requiredMinutes += 3 * Math.ceil(liveTimes / formValue.staminaCostMultiplier);
            }
            // イベント楽曲
            requiredMinutes += 3 * (fixedEventTimes[4] + fixedEventTimes[2] + fixedEventTimes[1]);
            return requiredMinutes;
        }
        const requiredMinutes = calculateRequiredMinutes();

        // 自然回復日時の計算
        const naturalRecoveryUnix = dayjs
            .unix(formValue.nowUnix)
            .add((consumedStamina - formValue.stamina) * 5, 'm')
            .unix();

        // 要回復元気の計算
        let requiredRecoveryStamina = 0;
        if (naturalRecoveryUnix > formValue.endUnix) {
            requiredRecoveryStamina = Math.ceil((naturalRecoveryUnix - formValue.endUnix) / 60 / 5);
        }

        // 計算結果を格納
        result[course] = {};
        result[course].workTimes = fixedWorkTimes;

        if (isWork) {
            result[course].liveTimes = Math.floor(liveTimes / formValue.ticketCostMultiplier).toLocaleString();
            if (liveTimes % formValue.ticketCostMultiplier) {
                result[course].liveTimes += `…${liveTimes % formValue.ticketCostMultiplier}`;
            }
        } else {
            result[course].liveTimes = Math.floor(liveTimes / formValue.staminaCostMultiplier).toLocaleString();
            if (liveTimes % formValue.staminaCostMultiplier) {
                result[course].liveTimes += `…${liveTimes % formValue.staminaCostMultiplier}`;
            }
        }

        result[course].consumedStamina = consumedStamina;
        result[course].naturalRecoveryUnix = naturalRecoveryUnix;
        result[course].requiredRecoveryStamina = requiredRecoveryStamina;
        result[course].consumedLiveTicket = consumedLiveTicket;
        result[course].liveEarnedPoint = liveEarnedPoint;

        result[course].eventTimes = fixedEventTimes;
        result[course].consumedItem = consumedItem;
        result[course].eventEarnedPoint = eventEarnedPoint;

        result[course].requiredMinutes = requiredMinutes;

        result[course].requiredTime = '';
        if (Math.floor(requiredMinutes / 60)) {
            result[course].requiredTime += `${Math.floor(requiredMinutes / 60)}時間`;
        }
        if (Math.ceil(requiredMinutes % 60)) {
            result[course].requiredTime += `${Math.ceil(requiredMinutes % 60)}分`;
        }
        if (!result[course].requiredTime) {
            result[course].requiredTime += '0分';
        }

        // 所要時間、要回復元気の最小値を格納
        if (minCost.requiredMinutes === undefined || minCost.requiredMinutes > requiredMinutes) {
            minCost.requiredMinutes = requiredMinutes;
        }
        if (minCost.requiredRecoveryStamina === undefined || minCost.requiredRecoveryStamina > requiredRecoveryStamina) {
            minCost.requiredRecoveryStamina = requiredRecoveryStamina;
        }
    }

    // 計算結果の表示
    function showResultByCouse(course, formValue, minResult, minCost) {
        const level = course.slice(0, 3);
        if (formValue.showCourse.length && formValue.showCourse.indexOf(course) === -1) {
            // 表示コースでなければ列を非表示
            $(`.${course}`).hide();
            const colspan = $(`.${level}_header`).prop('colspan');
            if (colspan > 1) {
                $(`.${level}_header`).prop('colspan', colspan - 1);
            } else {
                $(`.${level}_header`).hide();
            }
            return;
        }
        $(`.${course}`).show();
        $(`.${level}_header`).show();

        let workTimesHtml = '';
        [30, 25, 20]
            .filter((cost) => {
                return minResult[course].workTimes[cost] || cost === formValue.workStaminaCost;
            })
            .forEach((cost) => {
                if (workTimesHtml) {
                    workTimesHtml += '<br>';
                }
                let text = Math.floor(minResult[course].workTimes[cost] / formValue.staminaCostMultiplier).toLocaleString();
                if (minResult[course].workTimes[cost] % formValue.staminaCostMultiplier) {
                    text += `…${minResult[course].workTimes[cost] % formValue.staminaCostMultiplier}`;
                }
                workTimesHtml +=
                    `<label for="workStaminaCost${course}-${cost}">` +
                    `<input type="radio"` +
                    ` name="workStaminaCost${course}"` +
                    ` id="workStaminaCost${course}-${cost}"` +
                    ` value="${cost}" />` +
                    ` [${cost}] ${text}` +
                    `</label>`;
            });

        let eventTimesHtml = '';
        [4, 2, 1]
            .filter((multiplier) => {
                return minResult[course].eventTimes[multiplier] || multiplier === formValue.itemsCostMultiplier;
            })
            .forEach((multiplier) => {
                if (eventTimesHtml) {
                    eventTimesHtml += '<br>';
                }
                eventTimesHtml +=
                    `<label for="itemsCostMultiplier${course}-${multiplier}">` +
                    `<input type="radio"` +
                    ` name="itemsCostMultiplier${course}"` +
                    ` id="itemsCostMultiplier${course}-${multiplier}"` +
                    ` value="${multiplier}" />` +
                    ` [×${multiplier}] ${minResult[course].eventTimes[multiplier].toLocaleString()}` +
                    `</label>`;
            });

        function showResultText(field, minValue, unit, isLink) {
            let text = minValue;
            if (isLink) {
                text =
                    `<a href="../event-jewels-calculator/index.html?datetimeStart=${formValue.start}&datetimeEnd=${formValue.end}` +
                    `&consumedStamina=${minValue}&stamina=${formValue.stamina}">${minValue.toLocaleString()}</a>`;
            }
            if (unit) {
                text += ` ${unit}`;
            }
            $(`#${field}${course}`).html(text);
        }
        showResultText('workTimes', workTimesHtml);
        showResultText('liveTimes', minResult[course].liveTimes);
        showResultText('consumedStamina', minResult[course].consumedStamina, false, true);
        showResultText('naturalRecoveryAt', dayjs.unix(minResult[course].naturalRecoveryUnix).format('M/D H:mm'));
        showResultText('requiredRecoveryStamina', minResult[course].requiredRecoveryStamina.toLocaleString());
        showResultText('consumedLiveTicket', minResult[course].consumedLiveTicket.toLocaleString(), '枚');
        showResultText('liveEarnedPoint', minResult[course].liveEarnedPoint.toLocaleString(), 'pt');

        showResultText('eventTimes', eventTimesHtml);
        showResultText('consumedItem', minResult[course].consumedItem.toLocaleString(), '個');
        showResultText('eventEarnedPoint', minResult[course].eventEarnedPoint.toLocaleString(), 'pt');

        showResultText('requiredTime', minResult[course].requiredTime);

        // 表中のラジオボタンに初期値セット
        const workStaminaCost =
            [formValue.workStaminaCost, 30, 25, 20].find((cost) => {
                return minResult[course].workTimes[cost];
            }) || formValue.workStaminaCost;
        $(`[name="workStaminaCost${course}"][value="${workStaminaCost}"]`).prop('checked', true);
        const itemsCostMultiplier =
            [4, 2, 1].find((multiplier) => {
                return minResult[course].eventTimes[multiplier];
            }) || formValue.itemsCostMultiplier;
        $(`[name="itemsCostMultiplier${course}"][value="${itemsCostMultiplier}"]`).prop('checked', true);

        // 所要時間、要回復元気の最小値は青文字
        if (formValue.showCourse.length !== 1 && minResult[course].requiredMinutes === minCost.requiredMinutes) {
            $(`#requiredTime${course}`).addClass('info');
        } else {
            $(`#requiredTime${course}`).removeClass('info');
        }
        if (formValue.showCourse.length !== 1 && minResult[course].requiredRecoveryStamina === minCost.requiredRecoveryStamina) {
            $(`#requiredRecoveryStamina${course}`).addClass('info');
        } else {
            $(`#requiredRecoveryStamina${course}`).removeClass('info');
        }

        // 開催期限をオーバーする場合、赤文字
        if (minResult[course].naturalRecoveryUnix > formValue.endUnix) {
            $(`#naturalRecoveryAt${course}`).addClass('danger');
        } else {
            $(`#naturalRecoveryAt${course}`).removeClass('danger');
        }
        if (dayjs.unix(formValue.nowUnix).add(minResult[course].requiredMinutes, 'm').unix() > formValue.endUnix) {
            $(`#requiredTime${course}`).addClass('danger');
        } else {
            $(`#requiredTime${course}`).removeClass('danger');
        }
    }

    // ツアーの計算
    function calculateTune(formValue) {
        const result = {};
        const minCost = {};

        // 計算
        Object.keys(staminaCost).forEach((course) => {
            calculateByCouse(course, formValue, result, minCost);
        });

        // 表示
        $('._2m_header').prop('colspan', 2);
        $('._4m_header').prop('colspan', 2);
        $('._2p_header').prop('colspan', 2);
        $('._6m_header').prop('colspan', 2);
        $('._mm_header').prop('colspan', 2);
        Object.keys(staminaCost).forEach((course) => {
            showResultByCouse(course, formValue, result, minCost);
        });
    }

    function save() {
        const datetimeSave = dayjs().format('YYYY/M/D H:mm');

        const saveData = {
            start: $('#start').val(),
            end: $('#end').val(),
            target: $('#target').val(),
            now: $('#now').val(),
            isNow: $('#isNow').prop('checked'),
            stamina: $('#stamina').val(),
            liveTicket: $('#liveTicket').val(),
            myPoint: $('#myPoint').val(),
            myItem: $('#myItem').val(),
            eventBonus: $('#eventBonus').val(),
            mission: $('#mission').val(),
            workStaminaCost: $('[name="workStaminaCost"]:checked').val(),
            staminaCostMultiplier: $('[name="staminaCostMultiplier"]:checked').val(),
            ticketCostMultiplier: $('#ticketCostMultiplier').val(),
            itemsCostMultiplier: $('[name="itemsCostMultiplier"]:checked').val(),
            showCourse: $('[name="showCourse"]:checked')
                .map((i) => {
                    return $('[name="showCourse"]:checked').eq(i).val();
                })
                .get(),
            autoSave: $('#autoSave').prop('checked'),
            datetimeSave: datetimeSave,
        };

        localStorage.setItem(location.href.replace('index.html', ''), JSON.stringify(saveData));

        $('#datetimeSave').text(datetimeSave);
        $('#loadSave').prop('disabled', false);
        $('#clearSave').prop('disabled', false);
    }

    function calculate() {
        const formValue = getFormValue();
        calculateTargetPoint(formValue);
        calculateLoginBonus(formValue);
        calculateTune(formValue);
        if (formValue.isAutoSave) {
            save();
        }
    }

    // input要素の変更時
    $('#start').change(calculate);
    $('#end').change(calculate);
    $('#target').change(calculate);
    $('#now').change(() => {
        $('#isNow').prop('checked', true);
        if ($('#now').val() !== dayjs().format('YYYY-MM-DDTHH:mm')) {
            $('#isNow').prop('checked', false);
        }
        calculate();
    });
    $('#isNow').change(calculate);
    $('#stamina').change(calculate);
    $('#liveTicket').change(calculate);
    $('#myPoint').change(calculate);
    $('#myItem').change(calculate);
    $('#eventBonus').change(calculate);
    $('#mission').change(calculate);
    $('[name="workStaminaCost"]').change(calculate);
    $('[name="staminaCostMultiplier"]').change(calculate);
    $('#ticketCostMultiplier').change(calculate);
    $('[name="itemsCostMultiplier"]').change(calculate);
    $('[name="showCourse"]').change(() => {
        $('#showCourse-all').prop('checked', true);
        $('[name="showCourse"]').each((i) => {
            if (!$('[name="showCourse"]').eq(i).prop('checked')) {
                $('#showCourse-all').prop('checked', false);
            }
        });
        calculate();
    });
    $('#showCourse-all').change(() => {
        $('[name="showCourse"]').each((i) => {
            $('[name="showCourse"]').eq(i).prop('checked', $('#showCourse-all').prop('checked'));
        });
        calculate();
    });
    $('#update').click(calculate);
    $('#autoSave').change(calculate);

    // 回数増減ボタン
    $('.beforePlayWork').click(function () {
        // eslint-disable-next-line no-invalid-this
        const course = $(this).val();
        const formValue = getFormValue();

        $('#stamina').val(formValue.stamina + formValue.inTable.workStaminaCost[course] * formValue.staminaCostMultiplier);
        $('#liveTicket').val(formValue.liveTicket - formValue.inTable.workStaminaCost[course] * formValue.staminaCostMultiplier);

        calculate();
    });
    $('.afterPlayWork').click(function () {
        // eslint-disable-next-line no-invalid-this
        const course = $(this).val();
        const formValue = getFormValue();

        if (formValue.liveTicket + formValue.inTable.workStaminaCost[course] * formValue.staminaCostMultiplier > 500) {
            if (
                confirm(
                    `ライブチケットが${
                        formValue.liveTicket + formValue.inTable.workStaminaCost[course] * formValue.staminaCostMultiplier - 500
                    }枚超過します。\n超過分は加算されません。\n実行しますか？`
                )
            ) {
                $('#liveTicket').val(500);
            } else {
                return;
            }
        } else {
            $('#liveTicket').val(formValue.liveTicket + formValue.inTable.workStaminaCost[course] * formValue.staminaCostMultiplier);
        }

        $('#stamina').val(formValue.stamina - formValue.inTable.workStaminaCost[course] * formValue.staminaCostMultiplier);

        calculate();
    });
    $('.beforePlayTicketLive').click(function () {
        // eslint-disable-next-line no-invalid-this
        const course = $(this).val();
        const formValue = getFormValue();

        $('#liveTicket').val(formValue.liveTicket + staminaCost[course] * formValue.ticketCostMultiplier);
        $('#myPoint').val(formValue.myPoint - Math.ceil(points[course] * formValue.ticketCostMultiplier));
        $('#myItem').val(formValue.myItem - Math.ceil(points[course] * formValue.ticketCostMultiplier));

        calculate();
    });
    $('.afterPlayTicketLive').click(function () {
        // eslint-disable-next-line no-invalid-this
        const course = $(this).val();
        const formValue = getFormValue();

        $('#liveTicket').val(formValue.liveTicket - staminaCost[course] * formValue.ticketCostMultiplier);
        $('#myPoint').val(formValue.myPoint + Math.ceil(points[course] * formValue.ticketCostMultiplier));
        $('#myItem').val(formValue.myItem + Math.ceil(points[course] * formValue.ticketCostMultiplier));

        calculate();
    });
    $('.beforePlayLive').click(function () {
        // eslint-disable-next-line no-invalid-this
        const course = $(this).val();
        const formValue = getFormValue();

        $('#stamina').val(formValue.stamina + staminaCost[course] * formValue.staminaCostMultiplier);
        $('#myPoint').val(formValue.myPoint - points[course] * formValue.staminaCostMultiplier);
        $('#myItem').val(formValue.myItem - points[course] * formValue.staminaCostMultiplier);

        calculate();
    });
    $('.afterPlayLive').click(function () {
        // eslint-disable-next-line no-invalid-this
        const course = $(this).val();
        const formValue = getFormValue();

        $('#stamina').val(formValue.stamina - staminaCost[course] * formValue.staminaCostMultiplier);
        $('#myPoint').val(formValue.myPoint + points[course] * formValue.staminaCostMultiplier);
        $('#myItem').val(formValue.myItem + points[course] * formValue.staminaCostMultiplier);

        calculate();
    });
    $('.beforePlayEvent').click(function () {
        // eslint-disable-next-line no-invalid-this
        const course = $(this).val();
        const formValue = getFormValue();
        const earnPointsPerEventWithBonus = earnPointsPerEvent + Math.ceil((earnPointsPerEvent * formValue.eventBonus) / 100);

        $('#myItem').val(formValue.myItem + consumedItemPerEvent * formValue.inTable.itemsCostMultiplier[course]);
        $('#myPoint').val(formValue.myPoint - earnPointsPerEventWithBonus * formValue.inTable.itemsCostMultiplier[course]);
        $('#mission').val(formValue.mission + 1);

        calculate();
    });
    $('.afterPlayEvent').click(function () {
        // eslint-disable-next-line no-invalid-this
        const course = $(this).val();
        const formValue = getFormValue();
        const earnPointsPerEventWithBonus = earnPointsPerEvent + Math.ceil((earnPointsPerEvent * formValue.eventBonus) / 100);

        $('#myItem').val(formValue.myItem - consumedItemPerEvent * formValue.inTable.itemsCostMultiplier[course]);
        $('#myPoint').val(formValue.myPoint + earnPointsPerEventWithBonus * formValue.inTable.itemsCostMultiplier[course]);
        $('#mission').val(formValue.mission - 1);

        calculate();
    });

    // 保存ボタン
    $('#save').click(save);

    // 入力を初期化ボタン
    function defaultInput() {
        $('#start').val(dayjs().subtract(15, 'h').format('YYYY-MM-DDT15:00'));
        $('#end').val(dayjs().subtract(15, 'h').add(1, 'w').format('YYYY-MM-DDT20:59'));
        $('#target').val(30000);
        $('#now').val(dayjs().format('YYYY-MM-DDTHH:mm'));
        $('#isNow').prop('checked', true);
        $('#stamina').val(0);
        $('#liveTicket').val(0);
        $('#myPoint').val(0);
        $('#myItem').val(0);
        $('#eventBonus').val(0);
        $('#mission').val(50);
        $('[name="workStaminaCost"][value="20"]').prop('checked', true);
        $('[name="staminaCostMultiplier"][value="1"]').prop('checked', true);
        $('#ticketCostMultiplier').val(10);
        $('[name="itemsCostMultiplier"][value="1"]').prop('checked', true);
        $('[name="showCourse"]').each((i) => {
            if (
                ['_2m_live', '_2m_work', '_4m_live', '_4m_work', '_2p_live', '_2p_work', '_6m_live', '_6m_work', '_mm_live', '_mm_work'].indexOf(
                    $('[name="showCourse"]').eq(i).val()
                ) !== -1
            ) {
                $('[name="showCourse"]').eq(i).prop('checked', true);
            } else {
                $('[name="showCourse"]').eq(i).prop('checked', false);
            }
        });
        $('#showCourse-all').prop('checked', true);
        $('#autoSave').prop('checked', false);

        calculate();
    }
    $('#clearInput').click(defaultInput);

    // 保存した値を読込ボタン
    function loadSavedData() {
        const savedString = localStorage.getItem(location.href.replace('index.html', ''));

        if (!savedString) {
            return false;
        }

        const savedData = JSON.parse(savedString);

        $('#start').val(savedData.start);
        $('#end').val(savedData.end);
        $('#target').val(savedData.target);
        $('#now').val(savedData.now);
        $('#isNow').prop('checked', savedData.isNow);
        $('#stamina').val(savedData.stamina);
        $('#liveTicket').val(savedData.liveTicket);
        $('#myPoint').val(savedData.myPoint);
        $('#myItem').val(savedData.myItem);
        $('#eventBonus').val(savedData.eventBonus);
        $('#mission').val(savedData.mission);
        $(`[name="workStaminaCost"][value="${savedData.workStaminaCost}"]`).prop('checked', true);
        $(`[name="staminaCostMultiplier"][value="${savedData.staminaCostMultiplier}"]`).prop('checked', true);
        $('#ticketCostMultiplier').val(savedData.ticketCostMultiplier);
        $(`[name="itemsCostMultiplier"][value="${savedData.itemsCostMultiplier}"]`).prop('checked', true);
        $('#showCourse-all').prop('checked', true);
        $('[name="showCourse"]').each((i) => {
            if (savedData.showCourse.indexOf($('[name="showCourse"]').eq(i).val()) !== -1) {
                $('[name="showCourse"]').eq(i).prop('checked', true);
            } else {
                $('[name="showCourse"]').eq(i).prop('checked', false);
                $('#showCourse-all').prop('checked', false);
            }
        });
        $('#autoSave').prop('checked', savedData.autoSave);

        calculate();

        $('#datetimeSave').text(savedData.datetimeSave);
        $('#loadSave').prop('disabled', false);
        $('#clearSave').prop('disabled', false);

        return true;
    }
    $('#loadSave').click(loadSavedData);

    // 保存した値を削除ボタン
    $('#clearSave').click(() => {
        localStorage.removeItem(location.href.replace('index.html', ''));

        $('#datetimeSave').text('削除済');
        $('#loadSave').prop('disabled', true);
        $('#clearSave').prop('disabled', true);
    });

    // 画面表示時に保存した値を読込、保存した値がなければ入力の初期化
    if (!loadSavedData()) {
        defaultInput();
    }
})();
