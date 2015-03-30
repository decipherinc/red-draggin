/**
 * red-draggin v2.0.0
 *
 * Copyright (c) 2014 Marcel Juenemann mail@marcel-junemann.de
 * https://github.com/decipherinc/red-draggin
 *
 * License: MIT
 */
(function (angular) {
  'use strict';

  angular.module('fv.red-draggin', [])

  /**
   * Use the dnd-draggable attribute to make your element draggable
   *
   * Attributes:
   * - dnd-draggable      Required attribute. The value has to be an object that represents the data
   *                      of the element. In case of a drag and drop operation the object will be
   *                      serialized and unserialized on the receiving end.
   * - dnd-selected       Callback that is invoked when the element was clicked but not dragged.
   *                      The original click event will be provided in the local event variable.
   * - dnd-effect-allowed Use this attribute to limit the operations that can be performed. Options:
   *                      - 'move': The drag operation will move the element. This is the default.
   *                      - 'copy': The drag operation will copy the element. Shows a copy cursor.
   *                      - 'copyMove': The user can choose between copy and move by pressing the
   *                        ctrl or shift key. *Not supported in IE:* In Internet Explorer this
   *                        option will be the same as 'copy'. *Not fully supported in Chrome on
   *                        Windows:* In the Windows version of Chrome the cursor will always be the
   *                        move cursor. However, when the user drops an element and has the ctrl
   *                        key pressed, we will perform a copy anyways.
   *                      - HTML5 also specifies the 'link' option, but this library does not
   *                        actively support it yet, so use it at your own risk.
   * - dnd-moved          Callback that is invoked when the element was moved. Usually you will
   *                      remove your element from the original list in this callback, since the
   *                      directive is not doing that for you automatically. The original dragend
   *                      event will be provided in the local event variable.
   * - dnd-copied         Same as dnd-moved, just that it is called when the element was copied
   *                      instead of moved. The original dragend event will be provided in the local
   *                      event variable.
   * - dnd-dragstart      Callback that is invoked when the element was dragged. The original
   *                      dragstart event will be provided in the local event variable.
   * - dnd-type           Use this attribute if you have different kinds of items in your
   *                      application and you want to limit which items can be dropped into which
   *                      lists. Combine with dnd-allowed-types on the dnd-list(s). This attribute
   *                      should evaluate to a string, although this restriction is not enforced.
   * - dnd-disable-if     You can use this attribute to dynamically disable the draggability of the
   *                      element. This is useful if you have certain list items that you don't want
   *                      to be draggable, or if you want to disable drag & drop completely without
   *                      having two different code branches (e.g. only allow for admins).
   *                      **Note**: If your element is not draggable, the user is probably able to
   *                      select text or images inside of it. Since a selection is always draggable,
   *                      this breaks your UI. You most likely want to disable user selection via
   *                      CSS (see user-select).
   *
   * CSS classes:
   * - dndDragging        This class will be added to the element while the element is being
   *                      dragged. It will affect both the element you see while dragging and the
   *                      source element that stays at it's position. Do not try to hide the source
   *                      element with this class, because that will abort the drag operation.
   * - dndDraggingSource  This class will be added to the element after the drag operation was
   *                      started, meaning it only affects the original element that is still at
   *                      it's source position, and not the 'element' that the user is dragging with
   *                      his mouse pointer.
   */
    .directive('draggable',
    ['$parse', '$timeout', 'rdDropEffect', 'rdTransport',
      function ($parse, $timeout, rdDropEffect,
        rdTransport) {

        var nextBufferId;

        if (!angular.clone) {
          throw new Error('angular-types is required!');
        }

        // cache to manage data getting dragged and dropped
        nextBufferId = 0;

        return function (scope, element, attr) {
          // data buffer id
          var id,

            /**
             * Finds the container for the draggable item.
             * This is usually in the bowels of an ngRepeat expression,
             * but can be explicitly set via the `container` attribute.
             * @returns {(*|null)}
             */
            getContainer = function getContainer() {
              var match, container, repeater;
              if (attr.container) {
                container = scope.$eval(attr.container);
                if (angular.isArray(container)) {
                  return scope.$eval(attr.container);
                }
              }
              else if ((repeater = attr.ngRepeat)) {
                match = repeater
                  .match(/^\s*([\s\S]+?)\s+in\s+([\s\S]+?)(?:\s+as\s+([\s\S]+?))?(?:\s+track\s+by\s+([\s\S]+?))?\s*$/);
                if (match && (container = scope.$eval(match[2])) &&
                  angular.isArray(container)) {
                  return container;
                }
                else if (!match) {
                  return null;
                }
              }
              throw new Error('container must be an array');
            },

            onDragStart = function onDragStart(event) {
              id = (nextBufferId++).toString();
              event = event.originalEvent || event;

              event.dataTransfer.setData('Text', id);

              // Only allow actions specified in dnd-effect-allowed attribute
              event.dataTransfer.effectAllowed = attr.effectAllowed || 'move';

              // Add CSS classes. See documentation above
              element.addClass('dndDragging');
              $timeout(function () {
                element.addClass('dndDraggingSource');
              }, 0);

              // Workarounds for stupid browsers, see description below
              rdDropEffect.dropEffect = 'none';
              rdTransport.item = scope.$eval(attr.draggable);
              rdTransport.container = getContainer();

              // Save type of item in global state. Usually, this would go into the dataTransfer
              // typename, but we have to use 'Text' there to support IE
              rdTransport.dragType = scope.$eval(attr.type);

              // Invoke callback
              $parse(attr.onDragStart)(scope,
                {event: event, item: rdTransport.item});

              event.stopPropagation();
            },

            onDragEnd = function onDragEnd(event) {
              var dropEffect;
              event = event.originalEvent || event;

              // Invoke callbacks. Usually we would use event.dataTransfer.dropEffect to determine
              // the used effect, but Chrome has not implemented that field correctly. On Windows
              // it always sets it to 'none', while Chrome on Linux sometimes sets it to something
              // else when it's supposed to send 'none' (drag operation aborted).
              dropEffect = rdDropEffect.dropEffect;

              // TODO call callbacks with context of element scope
              $timeout(function () {
                scope.$apply(function () {
                  switch (dropEffect) {
                    case 'copy':
                      $parse(attr.onCopied)(scope,
                        {event: event, item: rdTransport.item});
                      break;
                    case 'move':
                    default:
                      $parse(attr.onMoved)(scope,
                        {event: event, item: rdTransport.item});
                  }
                });

                // Clean up
                element.removeClass('dndDragging');
                element.removeClass('dndDraggingSource');
                delete rdTransport.item;
                delete rdTransport.container;
              });

              event.stopPropagation();
            },

            onClick = function onClick(event) {
              event = event.originalEvent || event;

              scope.$apply(function () {
                $parse(attr.selected)(scope,
                  {event: event, item: rdTransport.item});
              });

              event.stopPropagation();
            },

            onSelectstart = function onSelectStart() {
              if (this.dragDrop) {
                this.dragDrop();
              }
              return false;
            };

          // Set the HTML5 draggable attribute on the element
          // TODO: should this be prop()?
          element.attr('draggable', 'true');

          // If the dnd-disable-if attribute is set, we have to watch that
          if (attr.disableIf) {
            scope.$watch(attr.disableIf, function (disabled) {
              element.attr('draggable', !disabled);
            });
          }

          /**
           * When the drag operation is started we have to prepare the dataTransfer object,
           * which is the primary way we communicate with the target element
           */
          element.on('dragstart', onDragStart);

          /**
           * The dragend event is triggered when the element was dropped or when the drag
           * operation was aborted (e.g. hit escape button). Depending on the executed action
           * we will invoke the callbacks specified with the dnd-moved or dnd-copied attribute.
           */
          element.on('dragend', onDragEnd);

          /**
           * When the element is clicked we invoke the callback function
           * specified with the dnd-selected attribute.
           */
          element.on('click', onClick);

          /**
           * Workaround to make element draggable in IE9
           */
          element.on('selectstart', onSelectstart);
        };
      }])

  /**
   * Use the dnd-list attribute to make your list element a dropzone. Usually you will add a single
   * li element as child with the ng-repeat directive. If you don't do that, we will not be able to
   * position the dropped element correctly. If you want your list to be sortable, also add the
   * dnd-draggable directive to your li element(s). Both the dnd-list and it's direct children must
   * have position: relative CSS style, otherwise the positioning algorithm will not be able to
   * determine the correct placeholder position in all browsers.
   *
   * Attributes:
   * - dnd-list             Required attribute. The value has to be the array in which the data of
   *                        the dropped element should be inserted.
   * - dnd-allowed-types    Optional array of allowed item types. When used, only items that had a
   *                        matching dnd-type attribute will be dropable.
   * - dnd-disable-if       Optional boolean expresssion. When it evaluates to true, no dropping
   *                        into the list is possible. Note that this also disables rearranging
   *                        items inside the list.
   * - dnd-horizontal-list  Optional boolean expresssion. When it evaluates to true, the positioning
   *                        algorithm will use the left and right halfs of the list items instead of
   *                        the upper and lower halfs.
   * - dnd-dragover         Optional expression that is invoked when an element is dragged over the
   *                        list. If the expression is set, but does not return true, the element is
   *                        not allowed to be dropped. The following variables will be available:
   *                        - event: The original dragover event sent by the browser.
   *                        - index: The position in the list at which the element would be dropped.
   *                        - type: The dnd-type set on the dnd-draggable, or undefined if unset.
   * - dnd-drop             Optional expression that is invoked when an element is dropped over the
   *                        list. If the expression is set, it must return the object that will be
   *                        inserted into the list. If it returns false, the drop will be aborted
   *                        and the event is propagated. The following variables will be available:
   *                        - event: The original drop event sent by the browser.
   *                        - index: The position in the list at which the element would be dropped.
   *                        - item: The transferred object.
   *                        - type: The dnd-type set on the dnd-draggable, or undefined if unset.
   * - dnd-external-sources Optional boolean expression. When it evaluates to true, the list accepts
   *                        drops from sources outside of the current browser tab. This allows to
   *                        drag and drop accross different browser tabs. Note that this will allow
   *                        to drop arbitrary text into the list, thus it is highly recommended to
   *                        implement the dnd-drop callback to check the incoming element for
   *                        sanity. Furthermore, the dnd-type of external sources can not be
   *                        determined, therefore do not rely on restrictions of dnd-allowed-type.
   *
   * CSS classes:
   * - dndPlaceholder       When an element is dragged over the list, a new placeholder child
   *                        element will be added. This element is of type li and has the class
   *                        dndPlaceholder set.
   * - dndDragover          Will be added to the list while an element is dragged over the list.
   */
    .directive('droppable',
    ['$parse', '$timeout', 'rdDropEffect', 'rdTransport',
      '$compile',
      function ($parse, $timeout, rdDropEffect,
        rdTransport, $compile) {

        return function (scope, element, attr) {
          /**
           * Check if the dataTransfer object contains a drag type that we can handle. In old versions
           * of IE the types collection will not even be there, so we just assume a drop is possible.
           */
          var hasTextMimetype = function hasTextMimetype(types) {
            var i;
            if (!types) {
              return true;
            }
            for (i = 0; i < types.length; i++) {
              if (types[i] === 'Text' ||
                types[i] === 'text/plain') {
                return true;
              }
            }

            return false;
          };

          /**
           * Invokes a callback with some interesting parameters and returns the callbacks return value.
           */
          var invokeCallback;
          /**
           * Small helper function that cleans up if we aborted a drop.
           */
          var stopDragover;
          /**
           * Checks various conditions that must be fulfilled for a drop to be allowed
           */
          var isDropAllowed;
          /**
           * We use the position of the placeholder node to determine at which position of the array the
           * object needs to be inserted
           */
          var getPlaceholderIndex;
          /**
           * Checks whether the mouse pointer is in the first half of the given target element.
           *
           * In Chrome we can just use offsetY, but in Firefox we have to use layerY, which only
           * works if the child element has position relative. In IE the events are only triggered
           * on the listNode instead of the listNodeItem, therefore the mouse positions are
           * relative to the parent element of targetNode.
           */
          var isMouseInFirstHalf;
          var placeholder = scope.$eval(attr.placeholder) ||
            angular.element('<li class="dndPlaceholder"></li>');
          var placeholderNode;
          var listNode = element[0];

          var horizontal = scope.$eval(attr.horizontalList);
          var externalSources = scope.$eval(attr.externalSources);

          var onDragover = function onDragover(event) {
              var listItemNode;
              event = event.originalEvent || event;

              if (!isDropAllowed(event)) {
                return true;
              }

              // First of all, make sure that the placeholder is shown
              // This is especially important if the list is empty
              if (!~Array.prototype.indexOf.apply(element.children(),
                  placeholder)) {
                scope.$apply(function () {
                  element.append(placeholder);
                  placeholder = $compile(placeholder)(scope);
                  placeholderNode = placeholder[0];
                });
              }

              if (event.target !== listNode) {
                // Try to find the node direct directly below the list node.
                listItemNode = event.target;
                while (listItemNode.parentNode !== listNode &&
                listItemNode.parentNode) {
                  listItemNode = listItemNode.parentNode;
                }

                if (listItemNode.parentNode === listNode &&
                  listItemNode !== placeholderNode) {
                  // If the mouse pointer is in the upper half of the child element,
                  // we place it before the child element, otherwise below it.
                  if (isMouseInFirstHalf(event, listItemNode)) {
                    listNode.insertBefore(placeholderNode, listItemNode);
                  } else {
                    listNode.insertBefore(placeholderNode,
                      listItemNode.nextSibling);
                  }
                }
              } else {
                // This branch is reached when we are dragging directly over the list element.
                // Usually we wouldn't need to do anything here, but the IE does not fire it's
                // events for the child element, only for the list directly. Therefore we repeat
                // the positioning algorithm for IE here.
                if (isMouseInFirstHalf(event, placeholderNode, true)) {
                  // Check if we should move the placeholder element one spot towards the top.
                  // Note that display none elements will have offsetTop and offsetHeight set to
                  // zero, therefore we need a special check for them.
                  while (placeholderNode.previousElementSibling
                  && (isMouseInFirstHalf(event,
                    placeholderNode.previousElementSibling, true)
                  ||
                  placeholderNode.previousElementSibling.offsetHeight === 0)) {
                    listNode.insertBefore(placeholderNode,
                      placeholderNode.previousElementSibling);
                  }
                } else {
                  // Check if we should move the placeholder element one spot towards the bottom
                  while (placeholderNode.nextElementSibling &&
                  !isMouseInFirstHalf(event, placeholderNode.nextElementSibling,
                    true)) {
                    listNode.insertBefore(placeholderNode,
                      placeholderNode.nextElementSibling.nextElementSibling);
                  }
                }
              }

              // At this point we invoke the callback, which still can disallow the drop.
              // We can't do this earlier because we want to pass the index of the placeholder.
              if (attr.onDragover && !invokeCallback(attr.onDragover, event)) {
                return stopDragover();
              }

              element.addClass('dndDragover');
              event.preventDefault();
              event.stopPropagation();
              return false;
            },

            insert = function insert(collection, idx, item) {
              collection.splice(idx, 0, item);
            },

          // While an element is dragged over the list, this placeholder element is inserted
          // at the location where the element would be inserted after dropping
            onDrop = function onDrop(event) {
              var placeholderIdx;
              var source;
              var dest;
              var item;
              var isCopy = !!event.ctrlKey;

              event = event.originalEvent || event;

              if (!isDropAllowed(event)) {
                return true;
              }

              // The default behavior in Firefox is to interpret the dropped element as URL and
              // forward to it. We want to prevent that even if our drop is aborted.
              event.preventDefault();

              item = rdTransport.item;
              source = rdTransport.container;

              // Invoke the callback, which can transform the transferredObject and even abort the drop.
              if (attr.onDrop &&
                (item = invokeCallback(attr.onDrop, event, item))
                && !item) {
                return stopDragover();
              }

              dest = scope.$eval(attr.droppable);
              placeholderIdx = getPlaceholderIndex();
              scope.$apply(function () {
                var removeIdx;
                if (isCopy) {
                  insert(dest, placeholderIdx, item);
                } else {
                  removeIdx = (source || dest).indexOf(item);
                  if ((source === dest && placeholderIdx >= removeIdx) ||
                    source !== dest) {
                    insert(dest, placeholderIdx, item);
                    source.splice(removeIdx, 1);

                  } else {
                    insert(dest, placeholderIdx, item);
                    source.splice(source.lastIndexOf(item), 1);
                  }
                }
              });

              // In Chrome on Windows the dropEffect will always be none...
              // We have to determine the actual effect manually from the allowed effects
              if (event.dataTransfer.dropEffect === 'none') {
                if (event.dataTransfer.effectAllowed === 'copy' ||
                  event.dataTransfer.effectAllowed === 'move') {
                  rdDropEffect.dropEffect =
                    event.dataTransfer.effectAllowed;
                } else {
                  rdDropEffect.dropEffect = isCopy ? 'copy' : 'move';
                }
              } else {
                rdDropEffect.dropEffect =
                  event.dataTransfer.dropEffect;
              }

              // Clean up
              stopDragover();
              event.stopPropagation();
              return false;
            },

            onDragleave = function onDragleave() {
              element.removeClass('dndDragover');
              $timeout(function () {
                if (!element.hasClass('dndDragover')) {
                  placeholder.remove();
                }
              }, 100);
            };

          /**
           * The dragover event is triggered 'every few hundred milliseconds' while an element
           * is being dragged over our list, or over an child element.
           */
          element.on('dragover', onDragover);

          /**
           * When the element is dropped, we use the position of the placeholder element as the
           * position where we insert the transferred data. This assumes that the list has exactly
           * one child element per array element.
           */
          element.on('drop', onDrop);

          /**
           * We have to remove the placeholder when the element is no longer dragged over our list. The
           * problem is that the dragleave event is not only fired when the element leaves our list,
           * but also when it leaves a child element -- so practically it's fired all the time. As a
           * workaround we wait a few milliseconds and then check if the dndDragover class was added
           * again. If it is there, dragover must have been called in the meantime, i.e. the element
           * is still dragging over the list. If you know a better way of doing this, please tell me!
           */
          element.on('dragleave', onDragleave);

          isMouseInFirstHalf = function isMouseInFirstHalf(event, targetNode,
            relativeToParent) {
            var mousePointer = horizontal ? (event.offsetX || event.layerX)
              : (event.offsetY || event.layerY);
            var targetSize = horizontal ? targetNode.offsetWidth :
              targetNode.offsetHeight;
            var targetPosition = horizontal ? targetNode.offsetLeft :
              targetNode.offsetTop;
            targetPosition = relativeToParent ? targetPosition : 0;
            return mousePointer < targetPosition + targetSize / 2;
          };

          getPlaceholderIndex = function getPlaceholderIndex() {
            return Array.prototype.indexOf.call(listNode.children,
              placeholderNode);
          };

          isDropAllowed = function isDropAllowed(event) {
            // Disallow drop from external source unless it's allowed explicitly.
            var allowed;
            if (!rdTransport.item && !externalSources) {
              return false;
            }

            // Check mimetype. Usually we would use a custom drag type instead of Text, but IE doesn't
            // support that.
            if (!hasTextMimetype(event.dataTransfer.types)) {
              return false;
            }

            // Now check the dnd-allowed-types against the type of the incoming element. For drops from
            // external sources we don't know the type, so it will need to be checked via dnd-drop.
            if (attr.allowedTypes && rdTransport.item) {
              allowed = scope.$eval(attr.allowedTypes);
              if (angular.isArray(allowed) &&
                allowed.indexOf(rdTransport.dragType) === -1) {
                return false;
              }
            }

            // Check whether droping is disabled completely
            return !(attr.disableIf && scope.$eval(attr.disableIf));
          };

          stopDragover = function stopDragover() {
            placeholder.remove();
            element.removeClass('dndDragover');
            return true;
          };

          invokeCallback =
            function invokeCallback(expression, event, item, data) {
              item = item || rdTransport.obj ||
              event.dataTransfer.getData('text/plain');
              return $parse(expression)(scope, angular.extend({
                event: event,
                index: getPlaceholderIndex(),
                item: item,
                container: rdTransport.container,
                external: !rdTransport.item,
                type: rdTransport.item ?
                  rdTransport.dragType : undefined
              }, data));
            };

        };

      }])

  /**
   * This workaround handles the fact that Internet Explorer does not support drag types other than
   * 'Text' and 'URL'. That means we can not know whether the data comes from one of our elements or
   * is just some other data like a text selection. As a workaround we save the object in
   * here. When a dropover event occurs, we only allow the drop if we are already dragging, because
   * that means the element is ours.
   */
    .value('rdTransport', {})

  /**
   * Chrome on Windows does not set the dropEffect field, which we need in dragend to determine
   * whether a drag operation was successful. Therefore we have to maintain it in this global
   * variable. The bug report for that has been open for years:
   * https://code.google.com/p/chromium/issues/detail?id=39399
   */
    .value('rdDropEffect', {});

}(window.angular));
