import type { ObjectInstance, ObjectType, PoseType } from './types';

const VALID_TYPES = new Set<string>(['person', 'face', 'hand', 'vehicle', 'object']);

function isObjectType(s: string): s is ObjectType {
  return VALID_TYPES.has(s);
}

export function parseSelector(expr: string): (instances: ObjectInstance[]) => ObjectInstance[] {
  const trimmed = expr.trim();
  if (trimmed === 'all') return (instances) => instances;

  // person[0].pose==running
  const fullMatch = trimmed.match(/^(\w+)(?:\[(\d+)\])?(?:\.(\w+)==(\w+))?$/);
  if (!fullMatch) return (instances) => instances;

  const [, typePart, indexPart, propName, propValue] = fullMatch;

  return (instances: ObjectInstance[]) => {
    let result = isObjectType(typePart)
      ? instances.filter(i => i.type === typePart)
      : instances;

    if (propName && propValue) {
      result = result.filter(i => {
        if (propName === 'pose') {
          return i.metadata['pose'] === propValue || (i.skeleton !== undefined && propValue === 'detected');
        }
        return (i.metadata[propName] as string | undefined) === propValue;
      });
    }

    if (indexPart !== undefined) {
      const idx = parseInt(indexPart, 10);
      return idx < result.length ? [result[idx]] : [];
    }

    return result;
  };
}

export class ObjectSelectionEngine {
  private selector: (instances: ObjectInstance[]) => ObjectInstance[] = (i) => i;

  setSelector(expr: string): void {
    this.selector = parseSelector(expr);
  }

  select(instances: ObjectInstance[]): ObjectInstance[] {
    return this.selector(instances);
  }

  filterByType(instances: ObjectInstance[], type: ObjectType): ObjectInstance[] {
    return instances.filter(i => i.type === type);
  }

  filterByPose(instances: ObjectInstance[], pose: PoseType): ObjectInstance[] {
    return instances.filter(i => i.metadata['pose'] === pose);
  }

  sortByConfidence(instances: ObjectInstance[]): ObjectInstance[] {
    return [...instances].sort((a, b) => b.confidence - a.confidence);
  }

  sortBySize(instances: ObjectInstance[]): ObjectInstance[] {
    return [...instances].sort(
      (a, b) => b.bbox.width * b.bbox.height - a.bbox.width * a.bbox.height,
    );
  }
}
