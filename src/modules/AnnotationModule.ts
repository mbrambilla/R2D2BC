/*
 * Project: R2D2BC - Web Reader
 * Developers: Aferdita Muriqi
 * Copyright (c) 2019. DITA. All rights reserved.
 * Developed on behalf of: Bokbasen AS (https://www.bokbasen.no), CAST (http://www.cast.org)
 * Licensed to: Bokbasen AS and CAST under one or more contributor license agreements.
 * Use of this source code is governed by a BSD-style license that can be found in the LICENSE file.
 */

 import * as HTMLUtilities from "../utils/HTMLUtilities";
import Annotator, { AnnotationType } from "../store/Annotator";
import IFrameNavigator, { ReaderRights, SelectionMenuItem } from "../navigator/IFrameNavigator";
import Publication, { Link } from "../model/Publication";
import TextHighlighter, { _highlights } from "./highlight/TextHighlighter";
import ReaderModule from "./ReaderModule";
import { addEventListenerOptional } from "../utils/EventHandler";
import { IHighlight } from "./highlight/common/highlight";
import { Bookmark,  Locator, Annotation, AnnotationMarker } from "../model/Locator";
import { IS_DEV } from "..";
import { toast } from "materialize-css";
import { UserSettings } from "../model/user-settings/UserSettings";
import { icons as IconLib } from "../utils/IconLib";
import { v4 as uuid } from 'uuid';

export type Highlight = (highlight: Annotation) => Promise<Annotation>

export interface AnnotationModuleAPI {
    addAnnotation: Highlight;
    deleteAnnotation: Highlight;
    selectedAnnotation: Highlight;
}

export interface AnnotationModuleConfig {
    annotator: Annotator;
    headerMenu: HTMLElement;
    rights: ReaderRights;
    publication: Publication;
    settings: UserSettings;
    delegate: IFrameNavigator;
    initialAnnotations?: any;
}

export default class AnnotationModule implements ReaderModule {

    api: AnnotationModuleAPI;
    annotator: Annotator | null;
    rights: ReaderRights;

    private publication: Publication;
    private settings: UserSettings;

    private highlightsView: HTMLDivElement;

    private headerMenu: HTMLElement;
    highlighter: TextHighlighter;

    private initialAnnotations: any;

    delegate: IFrameNavigator
    selectionMenuItems: SelectionMenuItem[];

    public static async create(config: AnnotationModuleConfig) {
        const annotations = new this(
            config.annotator,
            config.headerMenu,
            config.rights || { enableAnnotations: false },
            config.publication,
            config.settings,
            config.delegate,
            config.initialAnnotations || null
        );
        await annotations.start();
        return annotations;
    }


    public constructor(annotator: Annotator, headerMenu: HTMLElement, rights: ReaderRights,
        publication: Publication, settings: UserSettings, delegate: IFrameNavigator, initialAnnotations: any | null = null) {
        this.annotator = annotator
        this.rights = rights
        this.publication = publication
        this.settings = settings
        this.headerMenu = headerMenu
        this.delegate = delegate
        this.initialAnnotations = initialAnnotations;
        this.api = this.delegate.api
    }

    async stop() {

        if (IS_DEV) { console.log("Annotation module stop")}

    }

    protected async start(): Promise<void> {

        this.delegate.annotationModule = this

        if (this.headerMenu) this.highlightsView = HTMLUtilities.findElement(this.headerMenu, "#container-view-highlights") as HTMLDivElement;

        if (this.initialAnnotations) {
            var highlights = this.initialAnnotations['highlights'] || null;
            if (highlights) {
                this.annotator.initAnnotations(highlights)
            }
        }
    }

    handleResize(): any {
        setTimeout(() => {
            this.drawHighlights()
        }, 10);
    }

    initialAnnotationColor?: string

    initialize(initialAnnotationColor?:string) {
        this.initialAnnotationColor = initialAnnotationColor
        return new Promise(async (resolve) => {
            await (document as any).fonts.ready;
            if (this.rights.enableAnnotations) {
                const body = HTMLUtilities.findRequiredIframeElement(this.delegate.iframe.contentDocument, "body") as HTMLBodyElement;
                var self = this
                this.highlighter = new TextHighlighter(this, body, this.selectionMenuItems, {
                    onBeforeHighlight: function (selectionInfo: any) {
                        if (IS_DEV) {
                            console.log("onBeforeHighlight")
                            console.log("selectionInfo: " + selectionInfo);
                        }
                        return true
                    },
                    onAfterHighlight: async function (highlight: any, marker: AnnotationMarker) {
                        await self.saveAnnotation(highlight, marker)
                    }
                });
                setTimeout(() => {
                    this.drawHighlights()
                }, 300);
            }
            resolve();
        });
    }

    async scrollToHighlight(id: any): Promise<any> {
        if (IS_DEV) {console.log("still need to scroll to " + id)}
        var position = await this.annotator.getAnnotationPosition(id, this.highlighter.dom(this.highlighter.el).getWindow())
        window.scrollTo(0, position - (window.innerHeight / 3));
    }

    async deleteLocalHighlight(id: any): Promise<any> {
        if (this.annotator) {
            var deleted = await this.annotator.deleteAnnotation(id);

            if (IS_DEV) {console.log("Highlight deleted " + JSON.stringify(deleted));}
            await this.drawHighlights();
            if (this.delegate.material) {
                toast({ html: 'highlight deleted' })
            }
            return deleted

        } else {
            return new Promise<any>(resolve => resolve());
        }
    }

    public async deleteAnnotation(highlight: Annotation): Promise<any> {
        this.deleteLocalHighlight(highlight.id);
    }
    public async addAnnotation(highlight: Annotation): Promise<any> {
        await this.annotator.saveAnnotation(highlight);
        await this.drawHighlights();
    }

    public async deleteHighlight(highlight: Annotation): Promise<any> {
        if (this.api && this.api.deleteAnnotation) {
            this.api.deleteAnnotation(highlight).then(async () => {
                this.deleteLocalHighlight(highlight.id);
            })
        } else {
            this.deleteLocalHighlight(highlight.id);
        }
    }

    public async deleteSelectedHighlight(highlight: Annotation): Promise<any> {
        if (this.api && this.api.deleteAnnotation) {
            this.api.deleteAnnotation(highlight).then(async () => {
                this.deleteLocalHighlight(highlight.id);
            })
        } else {
            this.deleteLocalHighlight(highlight.id); 
        }
    }

    public async saveAnnotation(highlight: IHighlight, marker: AnnotationMarker): Promise<any> {
        if (this.annotator) {

            var tocItem = this.publication.getTOCItem(this.delegate.currentChapterLink.href);
            if (this.delegate.currentTocUrl !== null) {
                tocItem = this.publication.getTOCItem(this.delegate.currentTocUrl);
            }

            if (tocItem === null) {
                tocItem = this.publication.getTOCItemAbsolute(this.delegate.currentChapterLink.href);
            }
    
            const url = this.publication.getAbsoluteHref(tocItem.href);

            const bookmarkPosition = this.settings.getSelectedView().getCurrentPosition();

            const body = HTMLUtilities.findRequiredIframeElement(this.delegate.iframe.contentDocument, "body") as HTMLBodyElement;
            const progression = highlight.position ? (highlight.position / body.scrollHeight) : bookmarkPosition
            const id: string = uuid();

            const annotation: Annotation = {
                id: id,
                href: url,
                locations: {
                    progression: progression
                },
                created: new Date(),
                type: this.delegate.currentChapterLink.type,
                title: this.delegate.currentChapterLink.title,
                highlight: highlight,
                color: this.highlighter.getColor(),
                marker: marker,
                text: {
                    hightlight: highlight.selectionInfo.cleanText
                }
            }
            if (this.api && this.api.addAnnotation) {
                this.api.addAnnotation(annotation).then(async result => {
                    annotation.id = result.id
                    var saved = await this.annotator.saveAnnotation(annotation);
                    await this.drawHighlights();
                    return saved
                }) 
            } else {
                var saved = await this.annotator.saveAnnotation(annotation);
                await this.drawHighlights();
                return saved
            }

        } else {
            return new Promise<any>(resolve => resolve());
        }
    }

    async getAnnotations() : Promise<any>{
        let highlights: Array<any> = [];
        if (this.annotator) {
            highlights = await this.annotator.getAnnotations() as Array<any>;
        }
        return highlights
    }

    public async showHighlights(): Promise<void> {
        let highlights: Array<any> = [];
        if (this.annotator) {
            highlights = await this.annotator.getAnnotations() as Array<any>;
            if (highlights) {
                highlights.forEach(rangeRepresentation => {
                    rangeRepresentation.highlight.marker = rangeRepresentation.marker
                    _highlights.push(rangeRepresentation.highlight)
                })
            }
        }
        this.createTree(AnnotationType.Annotation, highlights, this.highlightsView)
    }

    async drawHighlights(): Promise<void> {
        if (this.rights.enableAnnotations && this.highlighter) {
            if (this.api) {
                    let highlights: Array<any> = [];
                    if (this.annotator) {
                        highlights = await this.annotator.getAnnotations() as Array<any>;
                    }
                    if (this.highlighter && highlights && this.delegate.iframe.contentDocument.readyState === 'complete') {

                        await this.highlighter.destroyAllhighlights(this.highlighter.dom(this.highlighter.el).getWindow().document)

                        highlights.forEach(async rangeRepresentation => {

                            rangeRepresentation.highlight.marker = rangeRepresentation.marker

                            _highlights.push(rangeRepresentation.highlight)

                            const annotation: Annotation = rangeRepresentation

                            let currentLocation = this.delegate.currentChapterLink.href;

                            var tocItem = this.publication.getTOCItem(currentLocation);
                            if (this.delegate.currentTocUrl !== null) {
                                tocItem = this.publication.getTOCItem(this.delegate.currentTocUrl);
                            }

                            if (tocItem === null) {
                                tocItem = this.publication.getTOCItemAbsolute(this.delegate.currentChapterLink.href);
                            }
                    
                            const url = this.publication.getAbsoluteHref(tocItem.href);

                            if (annotation.href === url) {

                                this.highlighter.setColor(annotation.color);

                                try {
                                    await this.highlighter.createHighlightDom(this.highlighter.dom(this.highlighter.el).getWindow(), rangeRepresentation.highlight)
                                } catch (err) {
                                    console.error(err)
                                }
                            }
                        });
                    }
            } else {
                let highlights: Array<any> = [];
                if (this.annotator) {
                    highlights = await this.annotator.getAnnotations() as Array<any>;
                }
                if (this.highlighter && highlights && this.delegate.iframe.contentDocument.readyState === 'complete') {

                    await this.highlighter.destroyAllhighlights(this.highlighter.dom(this.highlighter.el).getWindow().document)

                    highlights.forEach(async rangeRepresentation => {

                        rangeRepresentation.highlight.marker = rangeRepresentation.marker

                        _highlights.push(rangeRepresentation.highlight)

                        const annotation: Annotation = rangeRepresentation

                        let currentLocation = this.delegate.currentChapterLink.href;

                        var tocItem = this.publication.getTOCItem(currentLocation);
                        if (this.delegate.currentTocUrl !== null) {
                            tocItem = this.publication.getTOCItem(this.delegate.currentTocUrl);
                        }

                        if (tocItem === null) {
                            tocItem = this.publication.getTOCItemAbsolute(this.delegate.currentChapterLink.href);
                        }
                
                        const url = this.publication.getAbsoluteHref(tocItem.href);

                        if (annotation.href === url) {

                            this.highlighter.setColor(annotation.color);

                            try {
                                await this.highlighter.createHighlightDom(this.highlighter.dom(this.highlighter.el).getWindow(), rangeRepresentation.highlight)
                            } catch (err) {
                                console.error(err)
                            }
                        }
                    });
                }
            }
            if (this.initialAnnotationColor) {
                this.highlighter.setColor(this.initialAnnotationColor);
            }
        }
    }

    private createTree(type: AnnotationType, annotations: Array<any>, view: HTMLDivElement) {
        if (annotations) {
            const self = this;
            const toc = this.publication.readingOrder;
            if (toc.length) {
                const createAnnotationTree = (parentElement: Element, links: Array<Link>) => {
                    let chapterList: HTMLUListElement = document.createElement("ul");
                    chapterList.className = 'sidenav-annotations';
                    for (const link of links) {
                        let chapterHeader: HTMLLIElement = document.createElement("li");
                        const linkElement: HTMLAnchorElement = document.createElement("a");
                        const spanElement: HTMLSpanElement = document.createElement("span");
                        linkElement.tabIndex = -1;
                        linkElement.className = "chapter-link"
                        if (link.href) {
                            const linkHref = this.publication.getAbsoluteHref(link.href);
                            const tocItemAbs = this.publication.getTOCItemAbsolute(linkHref);
                            linkElement.href = linkHref;
                            linkElement.innerHTML = tocItemAbs.title || "";
                            chapterHeader.appendChild(linkElement);
                        } else {
                            spanElement.innerHTML = link.title || "";
                            spanElement.className = "chapter-title"
                            chapterHeader.appendChild(spanElement);
                        }

                        addEventListenerOptional(linkElement, 'click',  (event: MouseEvent) => {
                            event.preventDefault();
                            event.stopPropagation();

                            const position: Locator = {
                                href: linkElement.href,
                                locations: {
                                    progression: 0
                                },
                                type: link.type,
                                title: linkElement.title
                            };

                            this.delegate.navigate(position);
                        });

                        const bookmarkList: HTMLUListElement = document.createElement("ol");
                        annotations.forEach(function (locator: any) {

                            const href = (link.href.indexOf("#") !== -1)  ?  link.href.slice(0, link.href.indexOf("#")) : link.href

                            if (link.href && locator.href.endsWith(href)) {
                                let bookmarkItem: HTMLLIElement = document.createElement("li");
                                bookmarkItem.className = "annotation-item"
                                let bookmarkLink: HTMLAnchorElement = document.createElement("a");
                                bookmarkLink.setAttribute("href", locator.href);

                                if (type == AnnotationType.Annotation) {
                                    bookmarkLink.className = "highlight-link"
                                    bookmarkLink.innerHTML = IconLib.highlight
                                    let title: HTMLSpanElement = document.createElement("span");
                                    let marker: HTMLSpanElement = document.createElement("span");
                                    title.className = "title"
                                    marker.innerHTML = locator.highlight.selectionInfo.cleanText

                                    if ((locator as Annotation).marker == AnnotationMarker.Underline) {
                                        marker.style.setProperty("border-bottom", `2px solid ${TextHighlighter.hexToRgbA((locator as Annotation).color)}`, "important");
                                    } else {
                                        marker.style.backgroundColor = TextHighlighter.hexToRgbA((locator as Annotation).color);
                                    }
                                    title.appendChild(marker)
                                    bookmarkLink.appendChild(title)

                                    let subtitle: HTMLSpanElement = document.createElement("span");
                                    let formattedProgression = Math.round(locator.locations.progression!! * 100) + "% " +  "through resource"
                                    subtitle.className = "subtitle"
                                    subtitle.innerHTML = formattedProgression;
                                    bookmarkLink.appendChild(subtitle)
                                }

                                let timestamp: HTMLSpanElement = document.createElement("span");
                                timestamp.className = "timestamp"
                                timestamp.innerHTML = self.readableTimestamp(locator.created);
                                bookmarkLink.appendChild(timestamp)

                                addEventListenerOptional(bookmarkLink, 'click',  (event: MouseEvent) => {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    self.handleAnnotationLinkClick(event, locator);
                                });

                                bookmarkItem.appendChild(bookmarkLink);
                                if ((self.delegate.sideNavExanded && self.delegate.material) || !self.delegate.material) {
                                    let bookmarkDeleteLink: HTMLElement = document.createElement("button");
                                    bookmarkDeleteLink.className = "delete";
                                    bookmarkDeleteLink.innerHTML = IconLib.delete;

                                    addEventListenerOptional(bookmarkDeleteLink, 'click',  (event: MouseEvent) => {
                                        event.preventDefault();
                                        event.stopPropagation();
                                        self.handleAnnotationLinkDeleteClick(type, event, locator);
                                    });
                                    bookmarkItem.appendChild(bookmarkDeleteLink);
                                }
                                bookmarkList.appendChild(bookmarkItem);
                            }
                        });

                        if (bookmarkList.children.length > 0) {
                            chapterList.appendChild(chapterHeader);
                            chapterList.appendChild(bookmarkList);
                        }
                        if (chapterList.children.length > 0) {
                            parentElement.appendChild(chapterList);
                        }
                        if (link.children && link.children.length > 0) {
                            createAnnotationTree(parentElement, link.children);
                        }
                    }
                }
                view.innerHTML = '';
                createAnnotationTree(view, toc);
            }
        }
    }

    private handleAnnotationLinkClick(event: MouseEvent, locator: Bookmark): void {
        if (locator) {
            const linkHref = this.publication.getAbsoluteHref(locator.href);
            locator.href = linkHref    
            this.delegate.navigate(locator);
        } else {
            if (IS_DEV) {console.log('annotation data missing: ', event);}
        }
    }

    private handleAnnotationLinkDeleteClick(type: AnnotationType, event: MouseEvent, locator: any): void {
        if (IS_DEV) { console.log('annotation data locator: ', locator); }
        if (locator) {
            if (type == AnnotationType.Annotation) {
                this.deleteHighlight(locator);
            }
        } else {
            if (IS_DEV) {console.log('annotation data missing: ', event);}
        }
    }

    private readableTimestamp(timestamp: string) {
        const date = new Date(timestamp);
        return date.toDateString() + " " + date.toLocaleTimeString()
    }

}