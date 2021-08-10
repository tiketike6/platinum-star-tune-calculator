/* eslint-disable max-statements */
(function () {
    // dayjsのロケール設定
    dayjs.locale('ja');

    // コース毎の元気コストの設定
    const vitalityCost = {
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
    const consumedItemsPerEvent = 140;
    const earnPointsPerEvent = 490;

    // 入力値の取得
    function getFormValue() {
        const formValue = {};
        const errors = [];

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
        validDateTime('datetimeStart');
        validDateTime('datetimeEnd');

        formValue.endOfTodayUnix = dayjs().endOf('d').unix();
        if (formValue.endOfTodayUnix < formValue.datetimeStartUnix) {
            formValue.endOfTodayUnix = formValue.datetimeStartUnix;
        }
        if (formValue.endOfTodayUnix > formValue.datetimeEndUnix) {
            formValue.endOfTodayUnix = formValue.datetimeEndUnix;
        }

        formValue.nowUnix = dayjs().endOf('m').unix();
        if (formValue.nowUnix < formValue.datetimeStartUnix) {
            formValue.nowUnix = formValue.datetimeStartUnix;
            formValue.isFuture = true;
        }
        if (formValue.nowUnix > formValue.datetimeEndUnix) {
            formValue.nowUnix = formValue.datetimeEndUnix;
        }

        function validNumber(field) {
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
        validNumber('targetEnd');
        validNumber('vitality');
        validNumber('liveTickets');
        validNumber('ownPoints');
        validNumber('ownItems');
        validNumber('eventBonus');
        validNumber('mission');

        formValue.workVitalityCost = Number($('[name="workVitalityCost"]:checked').val());
        formValue.vitalityCostMultiplier = Number($('[name="vitalityCostMultiplier"]:checked').val());
        formValue.ticketCostMultiplier = Number($('#ticketCostMultiplier').val());
        formValue.itemsCostMultiplier = Number($('[name="itemsCostMultiplier"]:checked').val());
        formValue.showCourse = $('[name="showCourse"]:checked')
            .map((i) => {
                return $('[name="showCourse"]:checked').eq(i).val();
            })
            .get();
        formValue.isAutoSave = $('#autoSave').prop('checked');

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
        let diffEnd = formValue.targetEnd - formValue.ownPoints;
        if (diffEnd < 0) {
            diffEnd = 0;
        }
        $('#diffEnd').text(`(あと ${diffEnd.toLocaleString()} pt)`);

        $('#labelToday').text(`${dayjs.unix(formValue.endOfTodayUnix).format('M/D')}の目標pt`);

        const targetToday = Math.round(
            (formValue.targetEnd * (formValue.endOfTodayUnix - formValue.datetimeStartUnix)) /
                (formValue.datetimeEndUnix - formValue.datetimeStartUnix)
        );
        let diffToday = targetToday - formValue.ownPoints;
        if (diffToday < 0) {
            diffToday = 0;
        }
        $('#targetToday').text(`${targetToday.toLocaleString()} pt (あと ${diffToday.toLocaleString()} pt)`);

        $('#labelNow').text(`${dayjs.unix(formValue.nowUnix).format('M/D H:mm')}の目標pt`);

        const targetNow = Math.round(
            (formValue.targetEnd * (formValue.nowUnix - formValue.datetimeStartUnix)) / (formValue.datetimeEndUnix - formValue.datetimeStartUnix)
        );
        let diffNow = targetNow - formValue.ownPoints;
        if (diffNow < 0) {
            diffNow = 0;
        }
        $('#targetNow').text(`${targetNow.toLocaleString()} pt (あと ${diffNow.toLocaleString()} pt)`);
    }

    // ログインボーナスを考慮
    function calculateLoginBonus(formValue) {
        const loginBonusPerDay = 280;
        let loginBonus = dayjs.unix(formValue.datetimeEndUnix).endOf('d').diff(dayjs.unix(formValue.nowUnix), 'd') * loginBonusPerDay;
        if (formValue.isFuture) {
            loginBonus += loginBonusPerDay;
        }
        $('#loginBonus').text(`+ ログインボーナス ${loginBonus} 個`);
        formValue.loginBonus = loginBonus;

        const earnPointsPerEventWithBonus = earnPointsPerEvent + Math.ceil((earnPointsPerEvent * formValue.eventBonus) / 100);
        $('#expectedPoints').text(
            `(アイテム消費で ${(
                formValue.ownPoints +
                earnPointsPerEventWithBonus * Math.floor((formValue.ownItems + loginBonus) / consumedItemsPerEvent)
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

        let ownItems = formValue.ownItems + formValue.loginBonus;

        let liveTimes = 0;
        let consumedVitality = 0;
        let liveEarnedPoints = 0;

        let eventTimes = 0;
        let consumedItems = 0;
        let eventEarnedPoints = 0;

        // チケットライブで目標達成できるか判定
        function recommendTicketCostMultiplier() {
            let i = 1;
            for (i = 1; i <= formValue.ticketCostMultiplier; i++) {
                if (formValue.targetEnd <= formValue.ownPoints + liveEarnedPoints + eventEarnedPoints + Math.ceil(points[course] * i)) {
                    // チケットライブのみで目標達成
                    return i;
                }
            }
            for (i = 1; i <= formValue.ticketCostMultiplier; i++) {
                if (
                    ownItems + Math.ceil(points[course] * i) >= consumedItemsPerEvent &&
                    formValue.targetEnd <=
                        formValue.ownPoints + liveEarnedPoints + eventEarnedPoints + Math.ceil(points[course] * i) + earnPointsPerEventWithBonus
                ) {
                    // チケットライブとイベント楽曲で目標達成
                    return i;
                }
            }
            return formValue.ticketCostMultiplier;
        }

        // 通常楽曲回数、イベント楽曲回数を計算
        while (formValue.targetEnd > formValue.ownPoints + liveEarnedPoints + eventEarnedPoints) {
            // 累積ptが最終目標pt以上になるまで繰り返し
            if (ownItems >= consumedItemsPerEvent) {
                // アイテムを所持している場合、イベント楽曲
                ownItems -= consumedItemsPerEvent;
                eventTimes++;
                consumedItems += consumedItemsPerEvent;
                eventEarnedPoints += earnPointsPerEventWithBonus;
            } else if (isWork) {
                // アイテムを所持していない場合、チケットライブ
                const recommendedTicketCostMultiplier = recommendTicketCostMultiplier();
                liveTimes += recommendedTicketCostMultiplier;
                consumedVitality += vitalityCost[course] * recommendedTicketCostMultiplier;
                liveEarnedPoints += Math.ceil(points[course] * recommendedTicketCostMultiplier);
                ownItems += Math.ceil(points[course] * recommendedTicketCostMultiplier);
            } else {
                // アイテムを所持していない場合、通常楽曲
                liveTimes++;
                consumedVitality += vitalityCost[course];
                liveEarnedPoints += points[course];
                ownItems += points[course];
            }
        }

        // チケットライブでミッション達成できるか判定
        function recommendTicketCostMultiplierForMission() {
            let i = 1;
            for (i = 1; i <= formValue.ticketCostMultiplier; i++) {
                if (formValue.mission <= eventTimes + 1 && consumedItemsPerEvent <= ownItems + Math.ceil(points[course] * i)) {
                    // ミッション達成できるアイテムを獲得
                    return i;
                }
            }
            return formValue.ticketCostMultiplier;
        }

        // ミッションをクリアできない場合、再計算
        if (eventTimes < formValue.mission) {
            ownItems = formValue.ownItems + formValue.loginBonus;

            liveTimes = 0;
            consumedVitality = 0;
            liveEarnedPoints = 0;

            eventTimes = 0;
            consumedItems = 0;
            eventEarnedPoints = 0;

            while (formValue.mission > eventTimes) {
                // イベント楽曲回数がミッション以上になるまで繰り返し
                if (ownItems >= consumedItemsPerEvent) {
                    // アイテムを所持している場合、イベント楽曲
                    ownItems -= consumedItemsPerEvent;
                    eventTimes++;
                    consumedItems += consumedItemsPerEvent;
                    eventEarnedPoints += earnPointsPerEventWithBonus;
                } else if (isWork) {
                    // アイテムを所持していない場合、チケットライブ
                    const recommendedTicketCostMultiplier = recommendTicketCostMultiplierForMission();
                    liveTimes += recommendedTicketCostMultiplier;
                    consumedVitality += vitalityCost[course] * recommendedTicketCostMultiplier;
                    liveEarnedPoints += Math.ceil(points[course] * recommendedTicketCostMultiplier);
                    ownItems += Math.ceil(points[course] * recommendedTicketCostMultiplier);
                } else {
                    // アイテムを所持していない場合、通常楽曲
                    liveTimes++;
                    consumedVitality += vitalityCost[course];
                    liveEarnedPoints += points[course];
                    ownItems += points[course];
                }
            }
        }

        // お仕事回数の計算
        function calculateWorkTimes() {
            if (!isWork) {
                return {
                    consumedVitality: consumedVitality,
                    timesOf30: 0,
                    timesOf25: 0,
                    timesOf20: 0,
                };
            }
            const maxTimesOf30 = formValue.workVitalityCost >= 30 ? Math.ceil(consumedVitality / 30) : 0;
            const maxTimesOf25 = formValue.workVitalityCost >= 25 ? Math.ceil(consumedVitality / 25) : 0;
            const maxTimesOf20 = Math.ceil(consumedVitality / 20);
            let minVitality = Infinity;
            let bestTimesOf30 = maxTimesOf30;
            let bestTimesOf25 = maxTimesOf25;
            let bestTimesOf20 = maxTimesOf20;
            for (let i30 = maxTimesOf30; i30 >= 0; i30--) {
                for (let i25 = maxTimesOf25; i25 >= 0; i25--) {
                    for (let i20 = maxTimesOf20; i20 >= 0; i20--) {
                        const earnedLiveTickets = i30 * 30 + i25 * 25 + i20 * 20;
                        if (earnedLiveTickets + formValue.liveTickets === consumedVitality) {
                            // チケット枚数が消費枚数と同じなら無駄ゼロ
                            return {
                                consumedVitality: earnedLiveTickets,
                                timesOf30: i30,
                                timesOf25: i25,
                                timesOf20: i20,
                            };
                        }
                        if (earnedLiveTickets + formValue.liveTickets < consumedVitality) {
                            // チケット枚数が消費枚数未満なら達成不能
                            continue;
                        }
                        if (earnedLiveTickets < minVitality) {
                            // チケット枚数が最小なら格納
                            minVitality = earnedLiveTickets;
                            bestTimesOf30 = i30;
                            bestTimesOf25 = i25;
                            bestTimesOf20 = i20;
                        }
                    }
                }
            }
            return {
                consumedVitality: minVitality,
                timesOf30: bestTimesOf30,
                timesOf25: bestTimesOf25,
                timesOf20: bestTimesOf20,
            };
        }
        const workTimes = calculateWorkTimes();
        const consumedLiveTickets = consumedVitality;
        consumedVitality = workTimes.consumedVitality;
        const timesOf30 = workTimes.timesOf30;
        const timesOf25 = workTimes.timesOf25;
        const timesOf20 = workTimes.timesOf20;

        // 自然回復日時の計算
        const naturalRecoveryUnix = dayjs
            .unix(formValue.nowUnix)
            .add((consumedVitality - formValue.vitality) * 5, 'm')
            .unix();

        // 要回復元気の計算
        let requiredRecoveryVitality = 0;
        if (naturalRecoveryUnix > formValue.datetimeEndUnix) {
            requiredRecoveryVitality = Math.ceil((naturalRecoveryUnix - formValue.datetimeEndUnix) / 60 / 5);
        }

        // ミッションを考慮したイベント楽曲回数を計算
        function calculateEventTimesForMission() {
            const maxTimesOf4 = formValue.itemsCostMultiplier >= 4 ? eventTimes : 0;
            const maxTimesOf2 = formValue.itemsCostMultiplier >= 2 ? eventTimes : 0;
            const maxTimesOf1 = eventTimes;
            for (let i4 = maxTimesOf4; i4 >= 0; i4--) {
                for (let i2 = maxTimesOf2; i2 >= 0; i2--) {
                    for (let i1 = maxTimesOf1; i1 >= 0; i1--) {
                        if (i4 * 4 + i2 * 2 + i1 * 1 !== eventTimes || i4 + i2 + i1 < formValue.mission) {
                            continue;
                        }
                        // 合計が楽曲回数と同じ
                        return {
                            timesOf4: i4,
                            timesOf2: i2,
                            timesOf1: i1,
                        };
                    }
                }
            }
            return {
                timesOf4: 0,
                timesOf2: 0,
                timesOf1: eventTimes,
            };
        }
        const eventTimesForMission = calculateEventTimesForMission();
        const timesOf4 = eventTimesForMission.timesOf4;
        const timesOf2 = eventTimesForMission.timesOf2;
        const timesOf1 = eventTimesForMission.timesOf1;

        // 所要時間の計算
        function calculateRequiredMinutes() {
            // お仕事
            let requiredMinutes =
                0.5 *
                (Math.ceil(timesOf30 / formValue.vitalityCostMultiplier) +
                    Math.ceil(timesOf25 / formValue.vitalityCostMultiplier) +
                    Math.ceil(timesOf20 / formValue.vitalityCostMultiplier));
            if (isWork) {
                // チケットライブ
                requiredMinutes += 3 * Math.ceil(liveTimes / formValue.ticketCostMultiplier);
            } else {
                // 通常楽曲
                requiredMinutes += 3 * Math.ceil(liveTimes / formValue.vitalityCostMultiplier);
            }
            // イベント楽曲
            requiredMinutes += 3 * (timesOf4 + timesOf2 + timesOf1);
            return requiredMinutes;
        }
        const requiredMinutes = calculateRequiredMinutes();

        // 計算結果を格納
        result[course] = {};
        if (formValue.workVitalityCost === 30) {
            result[course].workTimes = Math.floor(timesOf30 / formValue.vitalityCostMultiplier).toLocaleString();
            if (timesOf30 % formValue.vitalityCostMultiplier) {
                result[course].workTimes += `…${timesOf30 % formValue.vitalityCostMultiplier}`;
            }
            if (timesOf25) {
                result[course].workTimes += `<br>[25] ${Math.floor(timesOf25 / formValue.vitalityCostMultiplier).toLocaleString()}`;
            }
            if (timesOf25 % formValue.vitalityCostMultiplier) {
                result[course].workTimes += `…${timesOf25 % formValue.vitalityCostMultiplier}`;
            }
            if (timesOf20) {
                result[course].workTimes += `<br>[20] ${Math.floor(timesOf20 / formValue.vitalityCostMultiplier).toLocaleString()}`;
            }
            if (timesOf20 % formValue.vitalityCostMultiplier) {
                result[course].workTimes += `…${timesOf20 % formValue.vitalityCostMultiplier}`;
            }
        } else if (formValue.workVitalityCost === 25) {
            result[course].workTimes = Math.floor(timesOf25 / formValue.vitalityCostMultiplier).toLocaleString();
            if (timesOf25 % formValue.vitalityCostMultiplier) {
                result[course].workTimes += `…${timesOf25 % formValue.vitalityCostMultiplier}`;
            }
            if (timesOf20) {
                result[course].workTimes += `<br>[20] ${Math.floor(timesOf20 / formValue.vitalityCostMultiplier).toLocaleString()}`;
            }
            if (timesOf20 % formValue.vitalityCostMultiplier) {
                result[course].workTimes += `…${timesOf20 % formValue.vitalityCostMultiplier}`;
            }
        } else {
            result[course].workTimes = Math.floor(timesOf20 / formValue.vitalityCostMultiplier).toLocaleString();
            if (timesOf20 % formValue.vitalityCostMultiplier) {
                result[course].workTimes += `…${timesOf20 % formValue.vitalityCostMultiplier}`;
            }
        }
        if (isWork) {
            result[course].liveTimes = Math.floor(liveTimes / formValue.ticketCostMultiplier).toLocaleString();
            if (liveTimes % formValue.ticketCostMultiplier) {
                result[course].liveTimes += `…${liveTimes % formValue.ticketCostMultiplier}`;
            }
        } else {
            result[course].liveTimes = Math.floor(liveTimes / formValue.vitalityCostMultiplier).toLocaleString();
            if (liveTimes % formValue.vitalityCostMultiplier) {
                result[course].liveTimes += `…${liveTimes % formValue.vitalityCostMultiplier}`;
            }
        }
        result[course].consumedVitality = consumedVitality;
        result[course].naturalRecoveryUnix = naturalRecoveryUnix;
        result[course].requiredRecoveryVitality = requiredRecoveryVitality;
        result[course].consumedLiveTickets = consumedLiveTickets;
        result[course].liveEarnedPoints = liveEarnedPoints;

        if (formValue.itemsCostMultiplier === 4) {
            result[course].eventTimes = timesOf4.toLocaleString();
            if (timesOf2) {
                result[course].eventTimes += `<br>[×2] ${timesOf2.toLocaleString()}`;
            }
            if (timesOf1) {
                result[course].eventTimes += `<br>[×1] ${timesOf1.toLocaleString()}`;
            }
        } else if (formValue.itemsCostMultiplier === 2) {
            result[course].eventTimes = timesOf2.toLocaleString();
            if (timesOf1) {
                result[course].eventTimes += `<br>[×1] ${timesOf1.toLocaleString()}`;
            }
        } else {
            result[course].eventTimes = timesOf1.toLocaleString();
        }
        result[course].consumedItems = consumedItems;
        result[course].eventEarnedPoints = eventEarnedPoints;

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

        // 消費元気、所要時間の最小値を格納
        if (minCost.consumedVitality === undefined || minCost.consumedVitality > consumedVitality) {
            minCost.consumedVitality = consumedVitality;
        }
        if (minCost.requiredMinutes === undefined || minCost.requiredMinutes > requiredMinutes) {
            minCost.requiredMinutes = requiredMinutes;
        }
    }

    // 計算結果の表示
    function showResultByCouse(course, formValue, minResult, minCost) {
        if (formValue.showCourse.length && formValue.showCourse.indexOf(course) === -1) {
            // 表示コースでなければ列を非表示
            $(`.${course}`).hide();
            const level = course.slice(0, 3);
            const colspan = $(`.${level}`).prop('colspan');
            if (colspan > 1) {
                $(`.${level}`).prop('colspan', colspan - 1);
            } else {
                $(`.${level}`).hide();
            }
            return;
        }
        $(`.${course}`).show();

        function showResultText(field, minValue, unit) {
            let text = minValue;
            if (unit) {
                text += ` ${unit}`;
            }
            $(`#${field}${course}`).html(text);
        }
        showResultText('workTimes', minResult[course].workTimes);
        showResultText('liveTimes', minResult[course].liveTimes);
        showResultText('consumedVitality', minResult[course].consumedVitality.toLocaleString());
        showResultText('naturalRecoveryAt', dayjs.unix(minResult[course].naturalRecoveryUnix).format('M/D H:mm'));
        showResultText('requiredRecoveryVitality', minResult[course].requiredRecoveryVitality.toLocaleString());
        showResultText('consumedLiveTickets', minResult[course].consumedLiveTickets.toLocaleString(), '枚');
        showResultText('liveEarnedPoints', minResult[course].liveEarnedPoints.toLocaleString(), 'pt');

        showResultText('eventTimes', minResult[course].eventTimes);
        showResultText('consumedItems', minResult[course].consumedItems.toLocaleString(), '個');
        showResultText('eventEarnedPoints', minResult[course].eventEarnedPoints.toLocaleString(), 'pt');

        showResultText('requiredTime', minResult[course].requiredTime);

        // 消費元気、所要時間の最小値は青文字
        if (formValue.showCourse.length !== 1 && minResult[course].consumedVitality === minCost.consumedVitality) {
            $(`#consumedVitality${course}`).addClass('info');
        } else {
            $(`#consumedVitality${course}`).removeClass('info');
        }
        if (formValue.showCourse.length !== 1 && minResult[course].requiredMinutes === minCost.requiredMinutes) {
            $(`#requiredTime${course}`).addClass('info');
        } else {
            $(`#requiredTime${course}`).removeClass('info');
        }

        // 開催期限をオーバーする場合、赤文字
        if (minResult[course].naturalRecoveryUnix > formValue.datetimeEndUnix) {
            $(`#naturalRecoveryAt${course}`).addClass('danger');
        } else {
            $(`#naturalRecoveryAt${course}`).removeClass('danger');
        }
        if (dayjs.unix(formValue.nowUnix).add(minResult[course].requiredMinutes, 'm').unix() > formValue.datetimeEndUnix) {
            $(`#requiredTime${course}`).addClass('danger');
        } else {
            $(`#requiredTime${course}`).removeClass('danger');
        }
    }

    // ツアーの計算
    function calculateTune(formValue) {
        const minResult = {};
        const minCost = {};

        // 計算
        Object.keys(vitalityCost).forEach((course) => {
            calculateByCouse(course, formValue, minResult, minCost);
        });

        // 表示
        $('._2m').prop('colspan', 2);
        $('._4m').prop('colspan', 2);
        $('._2p').prop('colspan', 2);
        $('._6m').prop('colspan', 2);
        $('._mm').prop('colspan', 2);
        $('._2m').show();
        $('._4m').show();
        $('._2p').show();
        $('._6m').show();
        $('._mm').show();
        Object.keys(vitalityCost).forEach((course) => {
            showResultByCouse(course, formValue, minResult, minCost);
        });
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
    $('#datetimeStart').change(calculate);
    $('#datetimeEnd').change(calculate);
    $('#targetEnd').change(calculate);
    $('#vitality').change(calculate);
    $('#liveTickets').change(calculate);
    $('#ownPoints').change(calculate);
    $('#ownItems').change(calculate);
    $('#eventBonus').change(calculate);
    $('#mission').change(calculate);
    $('[name="workVitalityCost"]').change(calculate);
    $('[name="vitalityCostMultiplier"]').change(calculate);
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
    $('#autoSave').change(calculate);
    $('#update').click(calculate);

    // 回数増減ボタン
    $('.subtractWorkTimes').click(function () {
        // eslint-disable-next-line no-invalid-this
        const course = $(this).val();
        const formValue = getFormValue();

        $('#vitality').val(formValue.vitality + vitalityCost[course] * formValue.vitalityCostMultiplier);
        $('#liveTickets').val(formValue.liveTickets - vitalityCost[course] * formValue.vitalityCostMultiplier);

        calculate();
    });
    $('.addWorkTimes').click(function () {
        // eslint-disable-next-line no-invalid-this
        const course = $(this).val();
        const formValue = getFormValue();

        if (formValue.liveTickets + vitalityCost[course] * formValue.vitalityCostMultiplier > 500) {
            if (
                confirm(
                    `ライブチケットが${
                        formValue.liveTickets + vitalityCost[course] * formValue.vitalityCostMultiplier - 500
                    }枚超過します。\n超過分は加算されません。\n実行しますか？`
                )
            ) {
                $('#liveTickets').val(500);
            } else {
                return;
            }
        } else {
            $('#liveTickets').val(formValue.liveTickets + vitalityCost[course] * formValue.vitalityCostMultiplier);
        }

        $('#vitality').val(formValue.vitality - vitalityCost[course] * formValue.vitalityCostMultiplier);

        calculate();
    });
    $('.subtractTicketLiveTimes').click(function () {
        // eslint-disable-next-line no-invalid-this
        const course = $(this).val();
        const formValue = getFormValue();

        $('#liveTickets').val(formValue.liveTickets + vitalityCost[course] * formValue.ticketCostMultiplier);
        $('#ownPoints').val(formValue.ownPoints - Math.ceil(points[course] * formValue.ticketCostMultiplier));
        $('#ownItems').val(formValue.ownItems - Math.ceil(points[course] * formValue.ticketCostMultiplier));

        calculate();
    });
    $('.addTicketLiveTimes').click(function () {
        // eslint-disable-next-line no-invalid-this
        const course = $(this).val();
        const formValue = getFormValue();

        $('#liveTickets').val(formValue.liveTickets - vitalityCost[course] * formValue.ticketCostMultiplier);
        $('#ownPoints').val(formValue.ownPoints + Math.ceil(points[course] * formValue.ticketCostMultiplier));
        $('#ownItems').val(formValue.ownItems + Math.ceil(points[course] * formValue.ticketCostMultiplier));

        calculate();
    });
    $('.subtractLiveTimes').click(function () {
        // eslint-disable-next-line no-invalid-this
        const course = $(this).val();
        const formValue = getFormValue();

        $('#vitality').val(formValue.vitality + vitalityCost[course] * formValue.vitalityCostMultiplier);
        $('#ownPoints').val(formValue.ownPoints - points[course] * formValue.vitalityCostMultiplier);
        $('#ownItems').val(formValue.ownItems - points[course] * formValue.vitalityCostMultiplier);

        calculate();
    });
    $('.addLiveTimes').click(function () {
        // eslint-disable-next-line no-invalid-this
        const course = $(this).val();
        const formValue = getFormValue();

        $('#vitality').val(formValue.vitality - vitalityCost[course] * formValue.vitalityCostMultiplier);
        $('#ownPoints').val(formValue.ownPoints + points[course] * formValue.vitalityCostMultiplier);
        $('#ownItems').val(formValue.ownItems + points[course] * formValue.vitalityCostMultiplier);

        calculate();
    });
    $('.subtractEventTimes').click(() => {
        const formValue = getFormValue();
        const earnPointsPerEventWithBonus = earnPointsPerEvent + Math.ceil((earnPointsPerEvent * formValue.eventBonus) / 100);

        $('#ownItems').val(formValue.ownItems + consumedItemsPerEvent * formValue.itemsCostMultiplier);
        $('#ownPoints').val(formValue.ownPoints - earnPointsPerEventWithBonus * formValue.itemsCostMultiplier);
        $('#mission').val(formValue.mission + 1);

        calculate();
    });
    $('.addEventTimes').click(() => {
        const formValue = getFormValue();
        const earnPointsPerEventWithBonus = earnPointsPerEvent + Math.ceil((earnPointsPerEvent * formValue.eventBonus) / 100);

        $('#ownItems').val(formValue.ownItems - consumedItemsPerEvent * formValue.itemsCostMultiplier);
        $('#ownPoints').val(formValue.ownPoints + earnPointsPerEventWithBonus * formValue.itemsCostMultiplier);
        $('#mission').val(formValue.mission - 1);

        calculate();
    });

    // 保存ボタン
    function save() {
        const datetimeSave = dayjs().format('YYYY/M/D H:mm');

        const saveData = {
            datetimeStart: $('#datetimeStart').val(),
            datetimeEnd: $('#datetimeEnd').val(),
            targetEnd: $('#targetEnd').val(),
            vitality: $('#vitality').val(),
            liveTickets: $('#liveTickets').val(),
            ownPoints: $('#ownPoints').val(),
            ownItems: $('#ownItems').val(),
            eventBonus: $('#eventBonus').val(),
            mission: $('#mission').val(),
            workVitalityCost: $('[name="workVitalityCost"]:checked').val(),
            vitalityCostMultiplier: $('[name="vitalityCostMultiplier"]:checked').val(),
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

        localStorage.setItem(location.href, JSON.stringify(saveData));

        $('#datetimeSave').text(datetimeSave);
        $('#loadSave').prop('disabled', false);
        $('#clearSave').prop('disabled', false);
    }
    $('#save').click(save);

    // 入力を初期化ボタン
    function defaultInput() {
        $('#datetimeStart').val(dayjs().subtract(15, 'h').format('YYYY-MM-DDT15:00'));
        $('#datetimeEnd').val(dayjs().subtract(15, 'h').add(1, 'w').format('YYYY-MM-DDT20:59'));
        $('#targetEnd').val(30000);
        $('#vitality').val(0);
        $('#liveTickets').val(0);
        $('#ownPoints').val(0);
        $('#ownItems').val(0);
        $('#eventBonus').val(0);
        $('#mission').val(50);
        $('[name="workVitalityCost"][value="20"]').prop('checked', true);
        $('[name="vitalityCostMultiplier"][value="1"]').prop('checked', true);
        $('#ticketCostMultiplier').val(10);
        $('[name="itemsCostMultiplier"][value="2"]').prop('checked', true);
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
        const savedString = localStorage.getItem(location.href);

        if (!savedString) {
            return false;
        }

        const savedData = JSON.parse(savedString);

        $('#datetimeStart').val(savedData.datetimeStart);
        $('#datetimeEnd').val(savedData.datetimeEnd);
        $('#targetEnd').val(savedData.targetEnd);
        $('#vitality').val(savedData.vitality);
        $('#liveTickets').val(savedData.liveTickets);
        $('#ownPoints').val(savedData.ownPoints);
        $('#ownItems').val(savedData.ownItems);
        $('#eventBonus').val(savedData.eventBonus);
        $('#mission').val(savedData.mission);
        $(`[name="workVitalityCost"][value="${savedData.workVitalityCost}"]`).prop('checked', true);
        $(`[name="vitalityCostMultiplier"][value="${savedData.vitalityCostMultiplier}"]`).prop('checked', true);
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
        localStorage.removeItem(location.href);

        $('#datetimeSave').text('削除済');
        $('#loadSave').prop('disabled', true);
        $('#clearSave').prop('disabled', true);
    });

    // 画面表示時に保存した値を読込、保存した値がなければ入力の初期化
    if (!loadSavedData()) {
        defaultInput();
    }
})();
