// @ts-strict-ignore
import React from 'react';
import { useTranslation } from 'react-i18next';

import { css } from 'glamor';
import {
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

import * as monthUtils from 'loot-core/src/shared/months';
import {
  amountToCurrency,
  amountToCurrencyNoDecimal,
} from 'loot-core/src/shared/util';
import { type SpendingEntity } from 'loot-core/src/types/models/reports';

import { usePrivacyMode } from '../../../hooks/usePrivacyMode';
import { theme, type CSSProperties } from '../../../style';
import { AlignedText } from '../../common/AlignedText';
import { Container } from '../Container';
import { numberFormatterTooltip } from '../numberFormatter';

type PayloadItem = {
  value: number;
  payload: {
    totalAssets: number | string;
    totalDebts: number | string;
    totalTotals: number | string;
    day: string;
    months: {
      date: string;
      cumulative: number | string;
    };
  };
};

type CustomTooltipProps = {
  active?: boolean;
  payload?: PayloadItem[];
  balanceTypeOp?: string;
  thisMonth?: string;
  lastYear?: string;
  selection?: string;
  compare?: string;
};

const CustomTooltip = ({
  active,
  payload,
  balanceTypeOp,
  thisMonth,
  lastYear,
  selection,
  compare,
}: CustomTooltipProps) => {
  const { t } = useTranslation();

  if (active && payload && payload.length) {
    const comparison =
      selection === 'average'
        ? payload[0].payload[selection] * -1
        : payload[0].payload.months[selection].cumulative * -1;
    return (
      <div
        className={`${css({
          zIndex: 1000,
          pointerEvents: 'none',
          borderRadius: 2,
          boxShadow: '0 1px 6px rgba(0, 0, 0, .20)',
          backgroundColor: theme.menuBackground,
          color: theme.menuItemText,
          padding: 10,
        })}`}
      >
        <div>
          <div style={{ marginBottom: 10 }}>
            <strong>
              {t('Day:') + ' '}
              {Number(payload[0].payload.day) >= 28
                ? t('28+')
                : payload[0].payload.day}
            </strong>
          </div>
          <div style={{ lineHeight: 1.5 }}>
            {payload[0].payload.months[thisMonth].cumulative ? (
              <AlignedText
                left={compare === 'thisMonth' ? t('This month:') : t('Last month:')}
                right={amountToCurrency(
                  payload[0].payload.months[thisMonth].cumulative * -1,
                )}
              />
            ) : null}
            {['cumulative'].includes(balanceTypeOp) && (
              <AlignedText
                left={
                  selection === 'average'
                    ? t('Average:')
                    : selection === lastYear
                      ? t('Last year:')
                      : compare === 'thisMonth'
                        ? t('Last month:')
                        : t('2 months ago:')
                }
                right={amountToCurrency(comparison)}
              />
            )}
            {payload[0].payload.months[thisMonth].cumulative ? (
              <AlignedText
                left={t("Difference:")}
                right={amountToCurrency(
                  payload[0].payload.months[thisMonth].cumulative * -1 -
                    comparison,
                )}
              />
            ) : null}
          </div>
        </div>
      </div>
    );
  }
};

type SpendingGraphProps = {
  style?: CSSProperties;
  data: SpendingEntity;
  compact?: boolean;
  mode: string;
  compare: string;
};

export function SpendingGraph({
  style,
  data,
  compact,
  mode,
  compare,
}: SpendingGraphProps) {
  const privacyMode = usePrivacyMode();
  const balanceTypeOp = 'cumulative';
  const thisMonth = monthUtils.subMonths(
    monthUtils.currentMonth(),
    compare === 'thisMonth' ? 0 : 1,
  );
  const previousMonth = monthUtils.subMonths(
    monthUtils.currentMonth(),
    compare === 'thisMonth' ? 1 : 2,
  );
  const lastYear = monthUtils.prevYear(thisMonth);
  let selection;
  switch (mode) {
    case 'average':
      selection = 'average';
      break;
    case 'lastYear':
      selection = lastYear;
      break;
    default:
      selection = previousMonth;
      break;
  }

  const thisMonthMax = data.intervalData.reduce((a, b) =>
    a.months[thisMonth][balanceTypeOp] < b.months[thisMonth][balanceTypeOp]
      ? a
      : b,
  ).months[thisMonth][balanceTypeOp];
  const selectionMax =
    selection === 'average'
      ? data.intervalData[27].average
      : data.intervalData.reduce((a, b) =>
          a.months[selection][balanceTypeOp] <
          b.months[selection][balanceTypeOp]
            ? a
            : b,
        ).months[selection][balanceTypeOp];
  const maxYAxis = selectionMax > thisMonthMax;
  const dataMax = Math.max(
    ...data.intervalData.map(i => i.months[thisMonth].cumulative),
  );
  const dataMin = Math.min(
    ...data.intervalData.map(i => i.months[thisMonth].cumulative),
  );

  const tickFormatter = tick => {
    if (!privacyMode) return `${amountToCurrencyNoDecimal(tick)}`; // Formats the tick values as strings with commas
    return '...';
  };

  const gradientOffset = () => {
    if (!dataMax || dataMax <= 0) {
      return 0;
    }
    if (!dataMin || dataMin >= 0) {
      return 1;
    }

    return dataMax / (dataMax - dataMin);
  };

  const getVal = (obj, month) => {
    if (month === 'average') {
      return obj[month] && -1 * obj[month];
    } else {
      return (
        obj.months[month][balanceTypeOp] &&
        -1 * obj.months[month][balanceTypeOp]
      );
    }
  };

  const getDate = obj => {
    return Number(obj.day) >= 28 ? '28+' : obj.day;
  };

  return (
    <Container
      style={{
        ...style,
        ...(compact && { height: 'auto' }),
      }}
    >
      {(width, height) =>
        data.intervalData && (
          <ResponsiveContainer>
            <div>
              {!compact && <div style={{ marginTop: '5px' }} />}
              <AreaChart
                width={width}
                height={height}
                data={data.intervalData}
                margin={{
                  top: 0,
                  right: 0,
                  left: 0,
                  bottom: 0,
                }}
              >
                {compact ? null : (
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                )}
                {compact ? null : (
                  <XAxis
                    dataKey={val => getDate(val)}
                    tick={{ fill: theme.pageText }}
                    tickLine={{ stroke: theme.pageText }}
                  />
                )}
                {compact ? null : (
                  <YAxis
                    dataKey={val =>
                      getVal(val, maxYAxis ? thisMonth : selection)
                    }
                    domain={[0, 'auto']}
                    tickFormatter={tickFormatter}
                    tick={{ fill: theme.pageText }}
                    tickLine={{ stroke: theme.pageText }}
                    tickSize={0}
                  />
                )}
                <Tooltip
                  content={
                    <CustomTooltip
                      balanceTypeOp={balanceTypeOp}
                      thisMonth={thisMonth}
                      lastYear={lastYear}
                      selection={selection}
                      compare={compare}
                    />
                  }
                  formatter={numberFormatterTooltip}
                  isAnimationActive={false}
                />
                <defs>
                  <linearGradient
                    id={`fill${balanceTypeOp}`}
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset={gradientOffset()}
                      stopColor={theme.reportsGreen}
                      stopOpacity={0.2}
                    />
                  </linearGradient>
                  <linearGradient
                    id={`stroke${balanceTypeOp}`}
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset={gradientOffset()}
                      stopColor={theme.reportsGreen}
                      stopOpacity={1}
                    />
                  </linearGradient>
                </defs>

                <Area
                  type="linear"
                  dot={false}
                  activeDot={{
                    fill: theme.reportsGreen,
                    fillOpacity: 1,
                    r: 10,
                  }}
                  animationDuration={0}
                  dataKey={val => getVal(val, thisMonth)}
                  stroke={`url(#stroke${balanceTypeOp})`}
                  strokeWidth={3}
                  fill={`url(#fill${balanceTypeOp})`}
                  fillOpacity={1}
                />
                <Area
                  type="linear"
                  dot={false}
                  activeDot={false}
                  animationDuration={0}
                  dataKey={val => getVal(val, selection)}
                  stroke="gray"
                  strokeDasharray="10 10"
                  strokeWidth={3}
                  fill="gray"
                  fillOpacity={0.2}
                />
              </AreaChart>
            </div>
          </ResponsiveContainer>
        )
      }
    </Container>
  );
}
