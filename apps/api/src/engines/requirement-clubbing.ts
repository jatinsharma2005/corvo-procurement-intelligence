import { PurchaseRequestLine, RequirementGroup, PlantCode } from '@corvo/shared-types';

export interface ClubbingParameters {
  clubbing_window_days: number;       // default 14
  clubbing_need_by_window_days: number; // default 7
}

export function clubPRLines(
  lines: PurchaseRequestLine[],
  params: ClubbingParameters = { clubbing_window_days: 14, clubbing_need_by_window_days: 7 }
): { groups: RequirementGroup[]; assignedLines: PurchaseRequestLine[] } {
  // Sort lines by creation time, pr_no, pr_line
  const sortedLines = [...lines].sort((a, b) => {
    const timeA = new Date(a.created_at).getTime();
    const timeB = new Date(b.created_at).getTime();
    if (timeA !== timeB) return timeA - timeB;
    if (a.pr_no !== b.pr_no) return a.pr_no.localeCompare(b.pr_no);
    return a.pr_line - b.pr_line;
  });

  const groups: RequirementGroup[] = [];
  let groupCounter = 1;

  for (const line of sortedLines) {
    const resolvedCode = line.resolved_item_code || 'NEW';
    const isNew = resolvedCode === 'NEW';

    // Section 1.2: A line that matches no item master item is a new item... is never clubbed with other lines
    if (isNew) {
      const groupId = `REQ-${String(groupCounter++).padStart(4, '0')}`;
      line.group_id = groupId;
      groups.push({
        group_id: groupId,
        resolved_item_code: 'NEW',
        plant: line.plant,
        first_created_at: line.created_at,
        first_need_by: line.need_by_date,
        is_emergency: line.urgency === 'Emergency',
        total_quantity: line.quantity,
        lines: [line]
      });
      continue;
    }

    const lineCreatedTime = new Date(line.created_at).getTime();
    const lineNeedByTime = new Date(line.need_by_date).getTime();
    const maxCreatedDiffMs = params.clubbing_window_days * 24 * 60 * 60 * 1000;
    const maxNeedByDiffMs = params.clubbing_need_by_window_days * 24 * 60 * 60 * 1000;

    let joinedGroup: RequirementGroup | null = null;

    // Join the earliest eligible group (Section 2.2)
    for (const group of groups) {
      if (group.resolved_item_code === resolvedCode && group.plant === line.plant) {
        const groupCreatedTime = new Date(group.first_created_at).getTime();
        const groupNeedByTime = new Date(group.first_need_by).getTime();

        const createdDiffMs = Math.abs(lineCreatedTime - groupCreatedTime);
        const needByDiffMs = Math.abs(lineNeedByTime - groupNeedByTime);

        if (createdDiffMs <= maxCreatedDiffMs && needByDiffMs <= maxNeedByDiffMs) {
          joinedGroup = group;
          break;
        }
      }
    }

    if (joinedGroup) {
      joinedGroup.lines.push(line);
      joinedGroup.total_quantity += line.quantity;
      if (line.urgency === 'Emergency') {
        joinedGroup.is_emergency = true;
      }
      line.group_id = joinedGroup.group_id;
    } else {
      const groupId = `REQ-${String(groupCounter++).padStart(4, '0')}`;
      line.group_id = groupId;
      groups.push({
        group_id: groupId,
        resolved_item_code: resolvedCode,
        plant: line.plant,
        first_created_at: line.created_at,
        first_need_by: line.need_by_date,
        is_emergency: line.urgency === 'Emergency',
        total_quantity: line.quantity,
        lines: [line]
      });
    }
  }

  // Requirement date is the creation date of its first line.
  // Order groups by requirement date (first_created_at), then group_id
  groups.sort((a, b) => {
    const timeA = new Date(a.first_created_at).getTime();
    const timeB = new Date(b.first_created_at).getTime();
    if (timeA !== timeB) return timeA - timeB;
    return a.group_id.localeCompare(b.group_id);
  });

  return { groups, assignedLines: sortedLines };
}
