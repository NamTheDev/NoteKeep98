const iconNames: Record<string,string> = {
  note:"description",folder:"folder",pencil:"edit",check:"check_box",search:"search",
  archive:"archive",trash:"delete",restore:"restore_from_trash",pin:"push_pin",
  bell:"notifications",palette:"palette",label:"label",list:"view_list",
  grid:"grid_view",more:"more_horiz",x:"close",settings:"settings",
  save:"save",upload:"upload",download:"download",copy:"content_copy",
  info:"info",warning:"warning",computer:"edit_note",clock:"schedule",
  star:"star",menu:"menu",sparkle:"auto_awesome",arrow:"chevron_right"
};
export const icon = (name: string): string =>
  `<span class="ui-icon material-symbols-rounded align-middle flex-shrink-0" aria-hidden="true">${iconNames[name] ?? 'description'}</span>`;
