const XLSX = require('xlsx');
const { getMongoModel } = require('../models/mongoModels');

const UserGroup = getMongoModel('user_groups');
const UserGroupMember = getMongoModel('user_group_members');
const User = getMongoModel('users');
const Lead = getMongoModel('leads');
const Deal = getMongoModel('deals');

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/**
 * Parses any date-like input to a valid timestamp
 */
function parseDateTimestamp(value) {
  if (!value) return null;
  if (value instanceof Date) {
    const t = value.getTime();
    return Number.isNaN(t) ? null : t;
  }
  if (typeof value === 'number') {
    return Number.isNaN(value) ? null : value;
  }
  const str = String(value).trim();
  if (!str) return null;

  // YYYY-MM-DD or YYYY/MM/DD
  const isoMatch = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (isoMatch) {
    const y = parseInt(isoMatch[1], 10);
    const m = parseInt(isoMatch[2], 10) - 1;
    const d = parseInt(isoMatch[3], 10);
    const dt = new Date(y, m, d, 0, 0, 0, 0);
    return Number.isNaN(dt.getTime()) ? null : dt.getTime();
  }

  // DD-MM-YYYY or DD/MM/YYYY
  const dmyMatch = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (dmyMatch) {
    const d = parseInt(dmyMatch[1], 10);
    const m = parseInt(dmyMatch[2], 10) - 1;
    const y = parseInt(dmyMatch[3], 10);
    const dt = new Date(y, m, d, 0, 0, 0, 0);
    return Number.isNaN(dt.getTime()) ? null : dt.getTime();
  }

  const dt = new Date(str);
  return Number.isNaN(dt.getTime()) ? null : dt.getTime();
}

/**
 * Resolves start and end bounds in UTC for the requested period according to IST
 */
function resolvePeriodBounds(period = 'yesterday', customStart = null, customEnd = null) {
  const nowUtc = Date.now();
  const nowIst = new Date(nowUtc + IST_OFFSET_MS);

  let fromTime = null;
  let toTime = null;
  let periodLabel = 'Yesterday';

  const normalized = String(period || 'yesterday').toLowerCase().trim();

  if (normalized === 'combined') {
    periodLabel = 'Combined (Yesterday & Last 7 Days)';
    return { fromTime: null, toTime: null, periodLabel };
  }

  if (normalized === 'yesterday') {
    periodLabel = 'Yesterday';
    // Yesterday in IST: 00:00:00.000 to 23:59:59.999
    const yIst = new Date(nowIst.getUTCFullYear(), nowIst.getUTCMonth(), nowIst.getUTCDate() - 1, 0, 0, 0, 0);
    const yEndIst = new Date(nowIst.getUTCFullYear(), nowIst.getUTCMonth(), nowIst.getUTCDate() - 1, 23, 59, 59, 999);
    fromTime = yIst.getTime() - IST_OFFSET_MS;
    toTime = yEndIst.getTime() - IST_OFFSET_MS;
  } else if (normalized === 'last_7_days' || normalized === 'weekly_7_days' || normalized === '7days') {
    periodLabel = 'Last 7 Days';
    // 7 days ago in IST: 00:00:00.000 to current timestamp
    const startIst = new Date(nowIst.getUTCFullYear(), nowIst.getUTCMonth(), nowIst.getUTCDate() - 7, 0, 0, 0, 0);
    fromTime = startIst.getTime() - IST_OFFSET_MS;
    toTime = nowUtc;
  } else if (normalized === 'today') {
    periodLabel = 'Today';
    const startIst = new Date(nowIst.getUTCFullYear(), nowIst.getUTCMonth(), nowIst.getUTCDate(), 0, 0, 0, 0);
    const endIst = new Date(nowIst.getUTCFullYear(), nowIst.getUTCMonth(), nowIst.getUTCDate(), 23, 59, 59, 999);
    fromTime = startIst.getTime() - IST_OFFSET_MS;
    toTime = endIst.getTime() - IST_OFFSET_MS;
  } else if (customStart && customEnd) {
    periodLabel = 'Custom Period';
    fromTime = parseDateTimestamp(customStart);
    const endT = parseDateTimestamp(customEnd);
    toTime = endT ? endT + 86399999 : null;
  } else {
    // Default to Yesterday
    periodLabel = 'Yesterday';
    const yIst = new Date(nowIst.getUTCFullYear(), nowIst.getUTCMonth(), nowIst.getUTCDate() - 1, 0, 0, 0, 0);
    const yEndIst = new Date(nowIst.getUTCFullYear(), nowIst.getUTCMonth(), nowIst.getUTCDate() - 1, 23, 59, 59, 999);
    fromTime = yIst.getTime() - IST_OFFSET_MS;
    toTime = yEndIst.getTime() - IST_OFFSET_MS;
  }

  return { fromTime, toTime, periodLabel };
}

/**
 * Checks whether an item's owner matches a user profile
 */
function isOwnerMatch(item, user, parentLead = null) {
  if (!item || !user) return false;

  const userIds = [
    String(user._id || ''),
    String(user.legacyId || ''),
    String(user.id || ''),
    user.ownerCode != null ? String(user.ownerCode) : null,
    user.employeeId != null ? String(user.employeeId) : null,
  ].filter(Boolean);

  const userNames = [
    String(user.name || '').trim().toLowerCase(),
    String(user.displayName || '').trim().toLowerCase(),
    String(user.username || '').trim().toLowerCase(),
  ].filter(Boolean);

  const userEmails = [
    String(user.email || '').trim().toLowerCase(),
  ].filter(Boolean);

  // Check numeric/id fields & owner codes
  const itemUserIds = [
    item.ownerUserId != null ? String(item.ownerUserId) : null,
    item.assignedTo != null ? String(item.assignedTo) : null,
    item.createdBy != null ? String(item.createdBy) : null,
    item.createdByUserId != null ? String(item.createdByUserId) : null,
    item.employeeId != null ? String(item.employeeId) : null,
    item.ownerCode != null ? String(item.ownerCode) : null,
    item.accountOwnerCode != null ? String(item.accountOwnerCode) : null,
    item.data?.ownerCode != null ? String(item.data.ownerCode) : null,
    item.data?.accountOwnerCode != null ? String(item.data.accountOwnerCode) : null,
    item.formData?.ownerCode != null ? String(item.formData.ownerCode) : null,
    item.formData?.accountOwnerCode != null ? String(item.formData.accountOwnerCode) : null,
    item.formData?.assignedTo != null ? String(item.formData.assignedTo) : null,
    item.formData?.createdByUserId != null ? String(item.formData.createdByUserId) : null,
    item.formData?.employeeId != null ? String(item.formData.employeeId) : null,
  ].filter(Boolean);

  if (itemUserIds.some((id) => userIds.includes(id))) {
    return true;
  }

  // Check text name fields
  const itemNames = [
    String(item.ownerName || '').trim().toLowerCase(),
    String(item.accountOwner || '').trim().toLowerCase(),
    String(item.accountOwnerName || '').trim().toLowerCase(),
    String(item.dealOwner || '').trim().toLowerCase(),
    String(item.dealOwnerName || '').trim().toLowerCase(),
    String(item.createdByUserName || '').trim().toLowerCase(),
    String(item.owner || '').trim().toLowerCase(),
    String(item.data?.accountOwner || '').trim().toLowerCase(),
    String(item.data?.dealOwner || '').trim().toLowerCase(),
    String(item.data?.ownerName || '').trim().toLowerCase(),
    String(item.formData?.accountOwner || '').trim().toLowerCase(),
    String(item.formData?.dealOwner || '').trim().toLowerCase(),
    String(item.formData?.ownerName || '').trim().toLowerCase(),
  ].filter(Boolean);

  if (itemNames.some((n) => userNames.includes(n))) {
    return true;
  }

  // Check email fields
  const itemEmails = [
    String(item.userEmail || '').trim().toLowerCase(),
    String(item.ownerEmail || '').trim().toLowerCase(),
    String(item.email || '').trim().toLowerCase(),
    String(item.createdUserBy || '').trim().toLowerCase(),
    String(item.data?.userEmail || '').trim().toLowerCase(),
    String(item.formData?.userEmail || '').trim().toLowerCase(),
  ].filter(Boolean);

  if (itemEmails.some((e) => userEmails.includes(e))) {
    return true;
  }

  if (parentLead) {
    return isOwnerMatch(parentLead, user);
  }

  return false;
}

function isItemWon(item) {
  if (!item) return false;
  const actualDealStatus = String(item.actualDealStatus || item.data?.actualDealStatus || item.formData?.actualDealStatus || '').toLowerCase().trim();
  const actualAccountStatus = String(item.actualAccountStatus || item.data?.actualAccountStatus || item.formData?.actualAccountStatus || '').toLowerCase().trim();
  const projectStatus = String(item.projectStatus || item.data?.projectStatus || item.formData?.projectStatus || '').toLowerCase().trim();
  const stage = String(item.stage || item.dealStage || item.data?.dealStage || item.formData?.dealStage || '').toLowerCase().trim();
  const status = String(item.status || item.dealStatus || item.data?.dealStatus || item.formData?.dealStatus || '').toLowerCase().trim();

  return (
    actualDealStatus === 'won' ||
    actualAccountStatus === 'won' ||
    projectStatus === 'won' ||
    stage === 'won' ||
    stage === 'convert_to_po' ||
    status === 'won' ||
    status === 'convert_to_po' ||
    status === 'converted'
  );
}

function isItemLost(item) {
  if (!item) return false;
  const actualDealStatus = String(item.actualDealStatus || item.data?.actualDealStatus || item.formData?.actualDealStatus || '').toLowerCase().trim();
  const actualAccountStatus = String(item.actualAccountStatus || item.data?.actualAccountStatus || item.formData?.actualAccountStatus || '').toLowerCase().trim();
  const projectStatus = String(item.projectStatus || item.data?.projectStatus || item.formData?.projectStatus || '').toLowerCase().trim();
  const stage = String(item.stage || item.dealStage || item.data?.dealStage || item.formData?.dealStage || '').toLowerCase().trim();
  const status = String(item.status || item.dealStatus || item.data?.dealStatus || item.formData?.dealStatus || '').toLowerCase().trim();

  return (
    actualDealStatus === 'lost' ||
    actualAccountStatus === 'lost' ||
    projectStatus === 'lost' ||
    stage === 'lost' ||
    stage === 'rejected' ||
    status === 'lost' ||
    status === 'rejected'
  );
}

function getWonItemTimestamp(item) {
  if (!item) return null;
  const raw =
    item.wonDate ||
    item.actualDealStatusDate ||
    item.actualAccountStatusDate ||
    item.statusDate ||
    item.convertedAt ||
    item.data?.wonDate ||
    item.formData?.wonDate ||
    item.dealDate ||
    item.data?.dealDate ||
    item.accountDate ||
    item.data?.accountDate ||
    item.addedOn ||
    item.updatedAt ||
    item.createdAt;
  return parseDateTimestamp(raw);
}

function getLostItemTimestamp(item) {
  if (!item) return null;
  const raw =
    item.lostDate ||
    item.actualDealStatusDate ||
    item.actualAccountStatusDate ||
    item.statusDate ||
    item.data?.lostDate ||
    item.formData?.lostDate ||
    item.dealDate ||
    item.data?.dealDate ||
    item.accountDate ||
    item.data?.accountDate ||
    item.addedOn ||
    item.updatedAt ||
    item.createdAt;
  return parseDateTimestamp(raw);
}

/**
 * Core function to fetch and compile Sales Performance Report data grouped by User Groups from MongoDB
 */
async function fetchSalesPerformanceData(options = {}) {
  const { period = 'yesterday', customStart = null, customEnd = null } = options;
  const normalized = String(period || 'yesterday').toLowerCase().trim();

  if (normalized === 'combined') {
    const yesterdayData = await fetchSalesPerformanceData({ ...options, period: 'yesterday' });
    const last7DaysData = await fetchSalesPerformanceData({ ...options, period: 'last_7_days' });
    return {
      period: 'combined',
      periodLabel: 'Combined (Yesterday & Last 7 Days)',
      isCombined: true,
      yesterdayData,
      last7DaysData,
      generatedAt: new Date().toISOString(),
      groupsData: yesterdayData.groupsData,
      overallTotals: {
        totalOpened: (yesterdayData.overallTotals?.totalOpened || 0) + (last7DaysData.overallTotals?.totalOpened || 0),
      },
    };
  }

  const { fromTime, toTime, periodLabel } = resolvePeriodBounds(period, customStart, customEnd);

  // 1. Fetch all active User Groups from MongoDB
  const groups = await UserGroup.find({ status: { $ne: 'inactive' } }).sort({ groupName: 1 }).lean();

  // 2. Fetch all members from user_group_members
  const members = await UserGroupMember.find({ status: { $ne: 'inactive' } }).lean();

  // 3. Fetch all active users from users collection
  const allUsers = await User.find({ status: { $ne: 'deleted' } }).lean();

  // Helper map for users: by legacyId and by _id
  const userByIdMap = new Map();
  allUsers.forEach((u) => {
    if (u.legacyId != null) userByIdMap.set(String(u.legacyId), u);
    if (u._id != null) userByIdMap.set(String(u._id), u);
    if (u.id != null) userByIdMap.set(String(u.id), u);
  });

  // 4. Fetch Leads
  const leads = await Lead.find({ status: { $ne: 'deleted' } }).lean();

  // Helper map for parent leads referenced by deals
  const leadsByIdMap = new Map();
  leads.forEach((l) => {
    if (l._id) leadsByIdMap.set(String(l._id), l);
    if (l.legacyId != null) leadsByIdMap.set(String(l.legacyId), l);
    if (l.id != null) leadsByIdMap.set(String(l.id), l);
    if (l.accountId != null) leadsByIdMap.set(String(l.accountId), l);
  });

  // 5. Fetch Deals
  const deals = await Deal.find({ frontendDeleted: { $ne: true } }).lean();

  // 6. Build Group-Wise Data
  const groupsData = [];

  for (let gIdx = 0; gIdx < groups.length; gIdx += 1) {
    const group = groups[gIdx];
    const groupIdStr = String(group._id || '');
    const groupLegacyIdStr = group.legacyId != null ? String(group.legacyId) : null;

    // Filter members belonging to this group
    const groupMembers = members.filter((m) => {
      const mGroupId = String(m.groupId || '');
      return mGroupId === groupIdStr || (groupLegacyIdStr && mGroupId === groupLegacyIdStr);
    });

    const rows = [];
    let groupTotalOpened = 0;
    let groupTotalConverted = 0;
    let groupTotalWon = 0;
    let groupTotalLost = 0;
    let groupTotalActive = 0;
    let groupTotalValue = 0;

    for (let mIdx = 0; mIdx < groupMembers.length; mIdx += 1) {
      const mem = groupMembers[mIdx];
      const user = userByIdMap.get(String(mem.userId || '')) || {
        _id: mem.userId,
        legacyId: mem.userId,
        name: mem.member?.name || mem.name || 'Sales Person',
        email: mem.member?.email || mem.email || '',
      };

      const personName = user.name || mem.member?.name || mem.name || `User ${mem.userId}`;

      // Calculate Metrics for this Sales Person
      let openedCount = 0;
      let convertedCount = 0;
      let wonCount = 0;
      let lostCount = 0;
      let activeCount = 0;
      let dealValueSum = 0;

      const wonEntityKeys = new Set();
      const lostEntityKeys = new Set();

      // Filter Leads for this person (prioritizing business dates)
      leads.forEach((l) => {
        if (!isOwnerMatch(l, user)) return;

        const leadDateRaw = l.accountDate || l.addedOn || l.data?.accountDate || l.data?.addedOn || l.createdAt;
        const createdTs = parseDateTimestamp(leadDateRaw);
        const inCreatedRange = (fromTime == null || toTime == null)
          ? true
          : (createdTs != null && createdTs >= fromTime && createdTs <= toTime);

        if (inCreatedRange) {
          openedCount += 1;
        }

        const isConvertedStatus = ['converted', 'convert_to_po'].includes(String(l.status || '').toLowerCase().trim());
        const isConvertedDeal = String(l.actualDealStatus || '').toLowerCase().trim() === 'won';

        if (isConvertedStatus || isConvertedDeal) {
          const convertedDateRaw = l.convertedAt || l.updatedAt || leadDateRaw;
          const convertedTs = parseDateTimestamp(convertedDateRaw);
          const inConvertedRange = (fromTime == null || toTime == null)
            ? true
            : (convertedTs != null && convertedTs >= fromTime && convertedTs <= toTime);
          if (inConvertedRange) {
            convertedCount += 1;
          }
        }

        const leadKey = String(l.legacyId || l.id || l._id);

        // Multi-collection: Count Won from Leads
        if (isItemWon(l)) {
          const wonTs = getWonItemTimestamp(l);
          const inWonRange = (fromTime == null || toTime == null)
            ? true
            : (wonTs != null && wonTs >= fromTime && wonTs <= toTime);
          if (inWonRange && !wonEntityKeys.has(leadKey)) {
            wonEntityKeys.add(leadKey);
            wonCount += 1;
          }
        }

        // Multi-collection: Count Lost from Leads
        if (isItemLost(l)) {
          const lostTs = getLostItemTimestamp(l);
          const inLostRange = (fromTime == null || toTime == null)
            ? true
            : (lostTs != null && lostTs >= fromTime && lostTs <= toTime);
          if (inLostRange && !lostEntityKeys.has(leadKey)) {
            lostEntityKeys.add(leadKey);
            lostCount += 1;
          }
        }
      });

      // Filter Deals for this person (prioritizing business dates)
      deals.forEach((d) => {
        const parentLead = d.leadId != null
          ? leadsByIdMap.get(String(d.leadId))
          : (d.accountId != null
            ? leadsByIdMap.get(String(d.accountId))
            : (d.sourceLeadId != null ? leadsByIdMap.get(String(d.sourceLeadId)) : null));

        if (!isOwnerMatch(d, user, parentLead)) return;

        const dealDateRaw = d.dealDate || d.addedOn || d.data?.dealDate || d.data?.addedOn || d.createdAt;
        const dealTs = parseDateTimestamp(dealDateRaw);

        const inDealDateRange = (fromTime == null || toTime == null)
          ? true
          : (dealTs != null && dealTs >= fromTime && dealTs <= toTime);

        const dedupKey = String(d.leadId || d.accountId || d.sourceLeadId || d._id);

        const dealIsWon = isItemWon(d);
        const dealIsLost = isItemLost(d);

        if (dealIsWon) {
          const wonTs = getWonItemTimestamp(d);
          const inWonRange = (fromTime == null || toTime == null)
            ? true
            : (wonTs != null && wonTs >= fromTime && wonTs <= toTime);
          if (inWonRange && !wonEntityKeys.has(dedupKey)) {
            wonEntityKeys.add(dedupKey);
            wonCount += 1;
          }
        } else if (dealIsLost) {
          const lostTs = getLostItemTimestamp(d);
          const inLostRange = (fromTime == null || toTime == null)
            ? true
            : (lostTs != null && lostTs >= fromTime && lostTs <= toTime);
          if (inLostRange && !lostEntityKeys.has(dedupKey)) {
            lostEntityKeys.add(dedupKey);
            lostCount += 1;
          }
        } else {
          // Open / in-pipeline active deal in date range
          if (inDealDateRange) {
            activeCount += 1;
          }
        }

        // Deal value strictly for deals within this period
        if (inDealDateRange) {
          const rawVal = Number(d.dealValue || d.value || d.amount || d.data?.dealValue || d.formData?.dealValue || 0);
          if (!Number.isNaN(rawVal)) {
            dealValueSum += rawVal;
          }
        }
      });

      const conversionRate = openedCount > 0
        ? `${Math.round((convertedCount / openedCount) * 100)}%`
        : '0%';

      rows.push({
        slNo: mIdx + 1,
        salesPerson: personName,
        newAccountsOpened: openedCount,
        newAccountsConverted: convertedCount,
        conversionRate,
        wonDeals: wonCount,
        lostDeals: lostCount,
        activeDeals: activeCount,
        totalDealValue: dealValueSum,
      });

      groupTotalOpened += openedCount;
      groupTotalConverted += convertedCount;
      groupTotalWon += wonCount;
      groupTotalLost += lostCount;
      groupTotalActive += activeCount;
      groupTotalValue += dealValueSum;
    }

    const groupOverallConversionRate = groupTotalOpened > 0
      ? `${Math.round((groupTotalConverted / groupTotalOpened) * 100)}%`
      : '0%';

    groupsData.push({
      groupIndex: gIdx + 1,
      groupId: groupIdStr,
      groupName: group.groupName || `Group ${gIdx + 1}`,
      rows,
      totals: {
        totalOpened: groupTotalOpened,
        totalConverted: groupTotalConverted,
        overallConversionRate: groupOverallConversionRate,
        totalWon: groupTotalWon,
        totalLost: groupTotalLost,
        totalActive: groupTotalActive,
        totalValue: groupTotalValue,
      },
    });
  }

  return {
    period,
    periodLabel,
    fromTime,
    toTime,
    generatedAt: new Date().toISOString(),
    groupsData,
  };
}

/**
 * Formats a number with Indian currency comma grouping
 */
function formatNumber(num) {
  if (num == null || Number.isNaN(num)) return '0';
  return Number(num).toLocaleString('en-IN');
}

function renderGroupsHtml(groupsData, sectionTitle) {
  let html = `
    <div style="margin-bottom: 32px;">
      <h2 style="color: #c60016; margin-bottom: 12px; font-size: 17px; font-weight: 700; border-bottom: 2px solid #c60016; padding-bottom: 6px;">
        ${sectionTitle}
      </h2>
  `;

  groupsData.forEach((grp) => {
    html += `
    <div style="margin-bottom: 26px;">
      <h3 style="font-size: 14px; font-weight: 700; color: #c60016; margin: 0 0 8px;">
        ${grp.groupIndex}. ${grp.groupName}
      </h3>
      <div style="width: 100%; overflow-x: auto; -webkit-overflow-scrolling: touch; margin: 0 0 14px 0; border: 1px solid #cbd5e1; border-radius: 6px; background: #ffffff;">
        <table style="min-width: 820px; width: 100%; border-collapse: collapse; font-size: 12px; border: none; text-align: center; margin: 0;">
          <thead>
            <tr style="background: linear-gradient(180deg, #dc2626 0%, #c60016 100%); color: #ffffff;">
              <th style="padding: 8px 6px; border: 1px solid #cbd5e1; width: 48px;">SL. No.</th>
              <th style="padding: 8px 10px; border: 1px solid #cbd5e1; text-align: left;">Sales Person</th>
              <th style="padding: 8px; border: 1px solid #cbd5e1;">New Accounts Opened</th>
              <th style="padding: 8px; border: 1px solid #cbd5e1;">New Accounts Converted</th>
              <th style="padding: 8px; border: 1px solid #cbd5e1;">Conversion Rate (%)</th>
              <th style="padding: 8px; border: 1px solid #cbd5e1;">Won Deals</th>
              <th style="padding: 8px; border: 1px solid #cbd5e1;">Lost Deals</th>
              <th style="padding: 8px; border: 1px solid #cbd5e1;">Active Deals</th>
              <th style="padding: 8px 10px; border: 1px solid #cbd5e1; text-align: right;">Total Deal Value</th>
            </tr>
          </thead>
          <tbody>
  `;

    if (grp.rows.length === 0) {
      html += `
            <tr>
              <td colspan="9" style="padding: 12px; color: #6b7280; font-style: italic; border: 1px solid #e5e7eb;">
                No sales members assigned to this group.
              </td>
            </tr>
  `;
    } else {
      grp.rows.forEach((row, rIdx) => {
        const bg = rIdx % 2 === 0 ? '#ffffff' : '#f9fafb';
        html += `
            <tr style="background: ${bg};">
              <td style="padding: 6px; border: 1px solid #e5e7eb; color: #4b5563;">${row.slNo}</td>
              <td style="padding: 6px 10px; border: 1px solid #e5e7eb; text-align: left; font-weight: 600; color: #111827;">${row.salesPerson}</td>
              <td style="padding: 6px; border: 1px solid #e5e7eb;">${row.newAccountsOpened}</td>
              <td style="padding: 6px; border: 1px solid #e5e7eb;">${row.newAccountsConverted}</td>
              <td style="padding: 6px; border: 1px solid #e5e7eb; font-weight: 600; color: #16a34a;">${row.conversionRate}</td>
              <td style="padding: 6px; border: 1px solid #e5e7eb; color: #16a34a; font-weight: 600;">${row.wonDeals}</td>
              <td style="padding: 6px; border: 1px solid #e5e7eb; color: #dc2626; font-weight: 600;">${row.lostDeals}</td>
              <td style="padding: 6px; border: 1px solid #e5e7eb;">${row.activeDeals}</td>
              <td style="padding: 6px 10px; border: 1px solid #e5e7eb; text-align: right; font-weight: 600;">₹${formatNumber(row.totalDealValue)}</td>
            </tr>
  `;
      });
    }

    // Group Total Row
    html += `
            <tr style="background: #f1f5f9; font-weight: 700; color: #0f172a; border-top: 2px solid #cbd5e1;">
              <td colspan="2" style="padding: 8px 10px; border: 1px solid #cbd5e1; text-align: left;">Total (${grp.groupName})</td>
              <td style="padding: 8px; border: 1px solid #cbd5e1;">${grp.totals.totalOpened}</td>
              <td style="padding: 8px; border: 1px solid #cbd5e1;">${grp.totals.totalConverted}</td>
              <td style="padding: 8px; border: 1px solid #cbd5e1; color: #16a34a;">${grp.totals.overallConversionRate}</td>
              <td style="padding: 8px; border: 1px solid #cbd5e1; color: #16a34a;">${grp.totals.totalWon}</td>
              <td style="padding: 8px; border: 1px solid #cbd5e1; color: #dc2626;">${grp.totals.totalLost}</td>
              <td style="padding: 8px; border: 1px solid #cbd5e1;">${grp.totals.totalActive}</td>
              <td style="padding: 8px 10px; border: 1px solid #cbd5e1; text-align: right;">₹${formatNumber(grp.totals.totalValue)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `;
  });

  html += `</div>`;
  return html;
}

/**
 * Generates pristine HTML email body matching the user's exact specification
 * Formatted with full HTML5 standalone envelope, scrollable table containers, and anti-trimming tokens
 */
function generateSalesPerformanceHtmlBody(reportResult, executionMeta = {}) {
  const { periodLabel, isCombined, yesterdayData, last7DaysData, groupsData } = reportResult;

  const now = new Date();
  const istDate = executionMeta.istDateStr || now.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric' });
  const istTime = executionMeta.istTimeStr || now.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true });
  const runId = executionMeta.runTag || Math.random().toString(36).substring(2, 7).toUpperCase();

  let html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Sales Performance Report – ${periodLabel}</title>
</head>
<body style="margin: 0; padding: 16px 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; line-height: 1.5;">

  <!-- Hidden Preheader for Inbox Preview without Trimming -->
  <div style="display: none; max-height: 0px; overflow: hidden; mso-hide: all; font-size: 1px; line-height: 1px; color: #f8fafc; opacity: 0;">
    Sales Performance Report (${periodLabel}) generated on ${istDate} at ${istTime} IST. Complete user group breakdown and metrics attached.
  </div>

  <div style="max-width: 980px; margin: 0 auto; background: #ffffff; padding: 24px 28px; border-radius: 8px; border: 1px solid #e2e8f0; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
    
    <!-- Top Branding & Execution Metadata -->
    <div style="border-bottom: 2px solid #f1f5f9; padding-bottom: 14px; margin-bottom: 20px;">
      <table style="width: 100%; border-collapse: collapse; border: none; margin: 0;">
        <tr>
          <td style="text-align: left; vertical-align: middle;">
            <div style="color: #c60016; font-size: 20px; font-weight: 800; letter-spacing: -0.3px; margin: 0 0 2px;">
              Swati Sales CRM
            </div>
            <div style="font-size: 13px; color: #475569; font-weight: 600;">
              Automated Sales Performance Reporting
            </div>
          </td>
          <td style="text-align: right; vertical-align: middle; font-size: 12px; color: #64748b;">
            <div>Generated: <strong style="color: #0f172a;">${istDate}, ${istTime} IST</strong></div>
            <div style="font-size: 11px; color: #94a3b8; margin-top: 2px;">Delivery Ref: #${runId}</div>
          </td>
        </tr>
      </table>
    </div>
`;

  if (isCombined && yesterdayData && last7DaysData) {
    html += renderGroupsHtml(yesterdayData.groupsData, 'Sales Performance Report – Yesterday');
    html += `<div style="margin: 36px 0; border-top: 2px dashed #cbd5e1;"></div>`;
    html += renderGroupsHtml(last7DaysData.groupsData, 'Sales Performance Report – Last 7 Days');
  } else {
    html += renderGroupsHtml(groupsData, `Sales Performance Report – ${periodLabel}`);
  }

  // Conclude with exact requested closing signature in main container
  html += `
    <div style="margin-top: 28px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 13px; color: #334155;">
      <p style="margin: 0 0 4px; font-weight: 500;">Thanks and Regards,</p>
      <p style="margin: 0; font-weight: 700; color: #c60016; font-size: 14px;">Swati Sales CRM Team</p>
    </div>
  </div>
</body>
</html>
`;

  return html;
}

function appendGroupsWorksheet(workbook, groupsData, sheetName, titleLabel) {
  const sheetRows = [];

  // Title Block
  sheetRows.push([titleLabel]);
  sheetRows.push([`Generated At: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST`]);
  sheetRows.push([]); // Empty spacing line

  groupsData.forEach((grp) => {
    // Group Header
    sheetRows.push([`${grp.groupIndex}. ${grp.groupName}`]);

    // Table Column Headers
    sheetRows.push([
      'SL. No.',
      'Sales Person',
      'New Accounts Opened',
      'New Accounts Converted',
      'Conversion Rate (%)',
      'Won Deals',
      'Lost Deals',
      'Active Deals',
      'Total Deal Value',
    ]);

    // Member Data Rows
    if (grp.rows.length === 0) {
      sheetRows.push(['-', 'No sales members assigned to this group', 0, 0, '0%', 0, 0, 0, 0]);
    } else {
      grp.rows.forEach((row) => {
        sheetRows.push([
          row.slNo,
          row.salesPerson,
          row.newAccountsOpened,
          row.newAccountsConverted,
          row.conversionRate,
          row.wonDeals,
          row.lostDeals,
          row.activeDeals,
          row.totalDealValue,
        ]);
      });
    }

    // Total Row
    sheetRows.push([
      `Total (${grp.groupName})`,
      '',
      grp.totals.totalOpened,
      grp.totals.totalConverted,
      grp.totals.overallConversionRate,
      grp.totals.totalWon,
      grp.totals.totalLost,
      grp.totals.totalActive,
      grp.totals.totalValue,
    ]);

    sheetRows.push([]); // Spacer between groups
  });

  const worksheet = XLSX.utils.aoa_to_sheet(sheetRows);

  // Auto-fit column widths
  worksheet['!cols'] = [
    { wch: 10 }, // SL. No.
    { wch: 28 }, // Sales Person
    { wch: 22 }, // New Accounts Opened
    { wch: 24 }, // New Accounts Converted
    { wch: 20 }, // Conversion Rate (%)
    { wch: 14 }, // Won Deals
    { wch: 14 }, // Lost Deals
    { wch: 14 }, // Active Deals
    { wch: 20 }, // Total Deal Value
  ];

  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.substring(0, 31));
}

/**
 * Generates an Excel workbook (.xlsx) containing all user group performance tables
 */
function generateSalesPerformanceExcelBuffer(reportResult) {
  const { periodLabel, isCombined, yesterdayData, last7DaysData, groupsData } = reportResult;
  const workbook = XLSX.utils.book_new();

  if (isCombined && yesterdayData && last7DaysData) {
    appendGroupsWorksheet(workbook, yesterdayData.groupsData, 'Performance_Yesterday', 'Sales Performance Report – Yesterday');
    appendGroupsWorksheet(workbook, last7DaysData.groupsData, 'Performance_Last_7_Days', 'Sales Performance Report – Last 7 Days');
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    const fileName = `Sales_Performance_Report_Combined_Yesterday_and_Last_7_Days_${new Date().toISOString().slice(0, 10)}.xlsx`;
    return { buffer, fileName };
  }

  appendGroupsWorksheet(workbook, groupsData, `Performance_${periodLabel.replace(/[^a-zA-Z0-9]/g, '_')}`, `Sales Performance Report – ${periodLabel}`);

  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  const fileName = `Sales_Performance_Report_${periodLabel.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`;

  return { buffer, fileName };
}

module.exports = {
  resolvePeriodBounds,
  fetchSalesPerformanceData,
  generateSalesPerformanceHtmlBody,
  generateSalesPerformanceExcelBuffer,
  parseDateTimestamp,
  isOwnerMatch,
};
