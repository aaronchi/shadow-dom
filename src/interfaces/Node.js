// https://dom.spec.whatwg.org/#interface-node

import * as $ from '../utils.js';

import CustomElements from '../custom-elements.js';

export default {

    get isConnected() {
        return $.shadowIncludingRoot(this).nodeType === Node.DOCUMENT_NODE;
    },

    getRootNode(options) {
        const composed = options && (options.composed === true);
        return composed ? $.shadowIncludingRoot(this) : $.root(this);
    },

    get parentNode() {
        let parentNode;
        const nodeState = $.getShadowState(this);
        if (nodeState) {
            parentNode = nodeState.parentNode;
        }

        return parentNode || $.descriptors.Node.parentNode.get.call(this);
    },

    get parentElement() {
        const parentNode = this.parentNode;
        if (parentNode && parentNode.nodeType === Node.ELEMENT_NODE) {
            return parentNode;
        }

        return null;
    },

    // TODO: tests
    hasChildNodes() {
        const nodeState = $.getShadowState(this);
        if (nodeState) {
            const childNodes = nodeState.childNodes;
            if (childNodes) {
                return childNodes.length > 0;
            }
        }

        return $.descriptors.Node.hasChildNodes.value.call(this);
    },

    // TODO: tests
    get childNodes() {
        const nodeState = $.getShadowState(this);
        if (nodeState) {
            const childNodes = nodeState.childNodes;
            if (childNodes) {
                const childNodesLength = childNodes.length;
                const result = new Array(childNodesLength);
                for (let i = 0; i < childNodesLength; i++) {
                    result[i] = childNodes[i];
                }
                return result;
            }
        }

        return $.descriptors.Node.childNodes.get.call(this);
    },

    // TODO: tests
    get firstChild() {
        const nodeState = $.getShadowState(this);
        if (nodeState) {
            const childNodes = nodeState.childNodes;
            if (childNodes) {
                if (childNodes.length) {
                    return childNodes[0];
                }
                return null;
            }
        }

        return $.descriptors.Node.firstChild.get.call(this);
    },

    // TODO: tests
    get lastChild() {
        const nodeState = $.getShadowState(this);
        if (nodeState) {
            const childNodes = nodeState.childNodes;
            if (childNodes) {
                if (childNodes.length) {
                    return childNodes[childNodes.length - 1];
                }
                return null;
            }
        }

        return $.descriptors.Node.lastChild.get.call(this);
    },

    // TODO: tests
    get previousSibling() {
        const nodeState = $.getShadowState(this);
        if (nodeState) {
            const parentNode = nodeState.parentNode;
            if (parentNode) {
                const childNodes = $.getShadowState(parentNode).childNodes;
                const siblingIndex = childNodes.indexOf(this) - 1;
                return siblingIndex < 0 ? null : childNodes[siblingIndex];
            }
        }

        return $.descriptors.Node.previousSibling.get.call(this);
    },

    // TODO: tests
    get nextSibling() {
        const nodeState = $.getShadowState(this);
        if (nodeState) {
            const parentNode = nodeState.parentNode;
            if (parentNode) {
                const childNodes = $.getShadowState(parentNode).childNodes;
                const siblingIndex = childNodes.indexOf(this) + 1;
                return siblingIndex === childNodes.length ? null : childNodes[siblingIndex];
            }
        }

        return $.descriptors.Node.nextSibling.get.call(this);
    },

    // TODO: consider creating a raw property descriptor
    // that uses the native get instead of a pass-through function
    get nodeValue() {
        return $.descriptors.Node.nodeValue.get.call(this);
    },

    // TODO: MutationObserver tests
    set nodeValue(value) {
        return CustomElements.executeCEReactions(() => {
            switch (this.nodeType) {
                case Node.ATTRIBUTE_NODE:
                    $.setExistingAttributeValue(this, value);
                    break;
                case Node.TEXT_NODE:
                case Node.PROCESSING_INSTRUCTION_NODE:
                case Node.COMMENT_NODE:
                    const length = $.descriptors.CharacterData.data.get.call(this).length;
                    $.replaceData(this, 0, length, value);
                    break;
            }
        });
    },

    get textContent() {
        switch (this.nodeType) {
            case Node.DOCUMENT_FRAGMENT_NODE:
            case Node.ELEMENT_NODE:
                return elementTextContent(this);
            case Node.ATTRIBUTE_NODE:
                return $.descriptors.Attr.value.get.call(this);
            case Node.TEXT_NODE:
            case Node.PROCESSING_INSTRUCTION_NODE:
            case Node.COMMENT_NODE:
                return $.descriptors.CharacterData.data.get.call(this);
            default:
                return null;
        }
    },

    // TODO: MutationObserver tests
    set textContent(value) {
        return CustomElements.executeCEReactions(() => {
            switch (this.nodeType) {
                case Node.DOCUMENT_FRAGMENT_NODE:
                case Node.ELEMENT_NODE:
                    let node = null;
                    if (value !== '') {
                        node = this.ownerDocument.createTextNode(value);
                    }
                    $.replaceAll(node, this);
                    break;
                case Node.ATTRIBUTE_NODE:
                    $.setExistingAttributeValue(this, value);
                    break;
                case Node.TEXT_NODE:
                case Node.PROCESSING_INSTRUCTION_NODE:
                case Node.COMMENT_NODE:
                    $.replaceData(this, 0, this.data.length, value);
                    break;
            }
        });
    },

    // TODO: tests
    normalize() {
        return CustomElements.executeCEReactions(() => {
            // https://dom.spec.whatwg.org/#dom-node-normalize
            // The normalize() method, when invoked, must run these steps 
            // for each descendant exclusive Text node node of context object:
            const childNodes = this.childNodes;
            const dataDescriptor = $.descriptors.CharacterData.data;
            for (let i = 0; i < childNodes.length; i++) {
                let childNode = childNodes[i];
                if (childNode.nodeType === Node.TEXT_NODE) {
                    let length = dataDescriptor.get.call(childNode).length;
                    if (length === 0) {
                        $.remove(childNode, this);
                        continue;
                    }
                    let data = '';
                    let contiguousTextNodes = new Array(childNodes.length);
                    let contiguousCount = 0;
                    let next = childNode;
                    while (next = next.nextSibling && next.nodeType === Node.TEXT_NODE) {
                        data += dataDescriptor.get.call(next);
                        contiguousTextNodes[contiguousCount++] = next;
                    }
                    $.replaceData(childNode, length, 0, data);
                    // TODO: (Range)
                    for (let j = 0; j < contiguousCount; j++) {
                        $.remove(contiguousTextNodes[j], this);
                    }
                }
                else {
                    childNode.normalize();
                }
            }
        });
    },

    // TODO: tests
    cloneNode(deep) {        
        return CustomElements.executeCEReactions(() => {
            // https://dom.spec.whatwg.org/#dom-node-clonenode
            // The cloneNode(deep) method, when invoked, must run these steps:

            // 1. If context object is a shadow root, then throw a NotSupportedError.
            if ($.isShadowRoot(this)) {
                throw $.makeError('NotSupportedError');
            }

            // 2. Return a clone of the context object, with the clone children flag set if deep is true.
            return $.clone(this, undefined, deep);
        });
    },

    // TODO: tests
    isEqualNode(other) {
        // https://dom.spec.whatwg.org/#dom-node-isequalnode
        // https://dom.spec.whatwg.org/#concept-node-equals
        if (!other) {
            return false;
        }

        if (this.nodeType !== other.nodeType) {
            return false;
        }

        let thisAttributes;
        let otherAttributes;

        switch (this.nodeType) {
            case Node.DOCUMENT_TYPE_NODE:
                if (this.name !== other.name ||
                    this.publicId !== other.publicId ||
                    this.systemId !== other.systemId) {
                    return false;
                }
                break;
            case Node.ELEMENT_NODE:
                if (this.namespaceURI !== other.namespaceURI ||
                    this.prefix !== other.prefix ||
                    this.localName !== other.localName) {
                    return false;
                }
                thisAttributes = $.descriptors.Element.attributes.get.call(this);
                otherAttributes = $.descriptors.Element.attributes.get.call(other);
                if (thisAttributes.length != otherAttributes.length) {
                    return false;
                }
                break;
            case Node.ATTRIBUTE_NODE:
                if (this.namespaceURI !== other.namespaceURI ||
                    this.localName !== other.localName ||
                    this.value !== other.value) {
                    return false;
                }
                break;
            case Node.PROCESSING_INSTRUCTION_NODE:
                if (this.target !== other.target ||
                    this.data !== other.data) {
                    return false;
                }
                break;
            case Node.TEXT_NODE:
            case Node.COMMENT_NODE:
                if (this.data !== other.data) {
                    return false;
                }
                break;
        }

        if (this.nodeType == Node.ELEMENT_NODE) {
            for (let i = 0; i < thisAttributes.length; i++) {
                let attr1 = thisAttributes[i];
                let attr2 = otherAttributes[attr1.name];
                if (attr1.value !== attr2.value) {
                    return false;
                }
            }
        }

        let childNodes1 = this.childNodes;
        let childNodes2 = other.childNodes;
        if (childNodes1.length !== other.childNodes.length) {
            return false;
        }

        for (let i = 0; i < childNodes1.length; i++) {
            if (!childNodes1[i].isEqualNode(childNodes2[i])) {
                return false;
            }
        }

        return true;
    },

    // TODO: tests
    compareDocumentPosition(other) {
        // https://dom.spec.whatwg.org/#dom-node-comparedocumentposition

        if (this === other) {
            return 0;
        }

        let node1 = other;
        let node2 = this;
        let attr1 = null;
        let attr2 = null;

        if (node1.nodeType == Document.prototype.ATTRIBUTE_NODE) {
            attr1 = node1;
            node1 = attr1.ownerElement;
        }

        if (node2.nodeType == Document.prototype.ATTRIBUTE_NODE) {
            attr2 = node2;
            node2 = attr2.ownerElement;

            if (attr1 && node1 && node2 === node1) {
                let attrs = node2.atttributes;
                for (let i = 0; i < attrs.length; i++) {
                    const attr = attrs[i];
                    if (attr.isEqualNode(attr1)) {
                        return Document.prototype.DOCUMENT_POSITION_IMPLEMENTATION_SPECIFIC
                            + Document.prototype.DOCUMENT_POSITION_PRECEDING;
                    }
                    else if (attr.isEqualNode(attr2)) {
                        return Document.prototype.DOCUMENT_POSITION_IMPLEMENTATION_SPECIFIC
                            + Document.prototype.DOCUMENT_POSITION_FOLLOWING;
                    }
                }
            }
        }

        if (!node1 || !node2 || $.root(node1) !== $.root(node2)) {
            return Document.prototype.DOCUMENT_POSITION_IMPLEMENTATION_SPECIFIC
                + Document.prototype.DOCUMENT_POSITION_FOLLOWING
                + Document.prototype.DOCUMENT_POSITION_DISCONNECTED;
        }

        if (ancestorOf(node2, node1) || ((node1 === node2) && attr2)) {
            return Document.prototype.DOCUMENT_POSITION_CONTAINS
                + Document.prototype.DOCUMENT_POSITION_PRECEDING;
        }

        if (ancestorOf(node1, node2) || ((node1 === node2) && attr1)) {
            return Document.prototype.DOCUMENT_POSITION_CONTAINS
                + Document.prototype.DOCUMENT_POSITION_FOLLOWING;
        }

        if (preceding(node1, node2)) {
            return Document.prototype.DOCUMENT_POSITION_PRECEDING;
        }

        return Document.prototype.DOCUMENT_POSITION_FOLLOWING;
    },

    // TODO: tests
    contains(node) {
        // https://dom.spec.whatwg.org/#dom-node-contains

        let parent = node.parentNode;

        if (!parent) {
            return false;
        }

        do {
            if (parent === this) {
                return true;
            }
        }
        while (parent = parent.parentNode);

        return false;
    },

    // TODO: tests
    insertBefore(node, child) {
        return CustomElements.executeCEReactions(() => {
            // https://dom.spec.whatwg.org/#dom-node-insertbefore
            // The insertBefore(node, child) method, when invoked, must return the result 
            // of pre-inserting node into context object before child.
            return $.preInsert(node, this, child);
        });
    },

    // TODO: tests
    appendChild(node) {
        return CustomElements.executeCEReactions(() => {
            // https://dom.spec.whatwg.org/#dom-node-appendchild
            // The appendChild(node) method, when invoked, must return the result of 
            // appending node to context object.
            return $.append(node, this);
        });
    },

    // TODO: tests
    replaceChild(node, child) {
        return CustomElements.executeCEReactions(() => {
            // https://dom.spec.whatwg.org/#dom-node-replacechild
            // The replaceChild(node, child) method, when invoked, must return the 
            // result of replacing child with node within context object.
            return $.replace(child, node, this);
        });
    },

    // TODO: tests
    removeChild(child) {
        return CustomElements.executeCEReactions(() => {
            // https://dom.spec.whatwg.org/#dom-node-removechild
            // The removeChild(child) method, when invoked, must return the result of 
            // pre-removing child from context object.
            return $.preRemove(child, this);
        });
    },

}

function ancestorOf(node, ancestor) {
    let parent = node.parentNode;

    do {
        if (parent === ancestor) {
            return true;
        }
    }
    while (parent = parent.parentNode);

    return false;
}

function preceding(element1, element2) {
    function precedingSiblings(parent, sibling1, sibling2) {
        let siblings = parent.childNodes;
        for (let i = 0; i < siblings.length; i++) {
            let sibling = siblings[i];
            if (sibling === sibling1) {
                return true;
            }
            else if (sibling === sibling2) {
                return false;
            }
        }
    }

    // Check if they're already siblings.
    let ancestor1 = element1.parentNode;
    let ancestor2 = element2.parentNode;

    if (ancestor1 === ancestor2) {
        return precedingSiblings(element1, element2);
    }

    // Find the closest common ancestor.
    let ancestors1 = [ancestor1];
    let ancestors2 = [ancestor2];

    while (ancestor1 = ancestor1.parentNode) {
        ancestors1.push(ancestor1);
    }

    while (ancestor2 = ancestor2.parentNode) {
        ancestors2.push(ancestor2);
    }

    ancestors1.reverse();
    ancestors2.reverse();

    let diff = Math.abs(ancestors1.length - ancestors2.length);
    let min = Math.min(ancestors1.length, ancestors2.length);

    let i = 0;
    while (ancestors1[i] === ancestors2[i]) {
        i++;
    }

    return precedingSiblings(ancestors1[i - 1], ancestors1[i], ancestors2[i]);
}

function elementTextContent(element) {
    let result = '';
    const childNodes = element.childNodes;                
    for (let i = 0; i < childNodes.length; i++) {
        const childNode = childNodes[i];
        switch (childNode.nodeType) {
            case Node.ELEMENT_NODE:
                result += elementTextContent(childNode);
                break;
            case Node.TEXT_NODE:
                result += $.descriptors.CharacterData.data.get.call(childNode);
                break;
        }
    }
    return result;
}